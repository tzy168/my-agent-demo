# 本项目 RAG 全流程（上传 → 检索 → LLM 回答）

本文按**真实执行顺序**说明：从上传文件，到切块、嵌入、入库，再到提问时检索并注入 System Prompt，最后流式输出文字。每一步附关键代码（路径相对仓库根目录）。

前置：本机已启动 [Ollama](https://ollama.com)，并拉取聊天模型与嵌入模型。

```bash
ollama pull qwen3.5:4b
ollama pull mxbai-embed-large:latest
pnpm dev
```

打开 http://localhost:3000/rag。

---

## 0. RAG 在解决什么问题

大模型不了解你刚上传的私有文档。**RAG（Retrieval-Augmented Generation）** 做法是：

1. 先把文档变成可检索的知识库  
2. 用户提问时，先找出最相关的几段原文  
3. 把这些原文塞进提示词，再让模型回答  

本 demo 刻意最小可用：

| 环节 | 本项目做法 |
|------|------------|
| 文档格式 | `.txt` / `.md` / `.markdown`，≤1MB |
| 向量库 | 进程内存数组（重启/热重载清空） |
| 相似度 | 余弦相似度（越高越相关） |
| 嵌入 | 固定 Ollama（`mxbai-embed-large`） |
| 生成 | Ollama 或 DeepSeek（设置页切换），流式纯文本 |

---

## 1. 整体数据流

```
【入库】
上传文件 → FormData POST /api/rag/upload
  → 校验扩展名/大小（可选 clear 清空库）
  → file.text() 读成字符串
  → splitText：400 字窗口 + 60 overlap 切块
  → OllamaEmbeddings.embedDocuments → 向量
  → 写入内存 store[]

【问答】
用户提问 → POST /api/rag/chat { msg, provider?, apiKey? }
  → embedQuery(问题) → 与 store 算余弦相似度 → Top-K
  → 命中片段拼进 System Prompt
  → createChatModel().stream(...) → 纯文本 ReadableStream
  → 响应头 X-Rag-Hits 带回命中 JSON；前端边读流边渲染
```

| 文件 | 职责 |
|------|------|
| `components/Rag/index.tsx` | 上传 / 检索试玩 / RAG Chat UI |
| `app/api/rag/upload/route.ts` | 接收文件并索引 |
| `app/api/rag/search/route.ts` | 只检索，返回相似度 |
| `app/api/rag/chat/route.ts` | 检索 + 生成（流式） |
| `app/api/rag/status/route.ts` | 当前 chunk 数与来源 |
| `lib/server/rag.ts` | 切分、嵌入、检索、RAG 流式对话 |
| `lib/server/model.ts` | `createChatModel`（生成模型工厂） |
| `hooks/useStreamingChat/index.ts` | 前端读流、增量更新消息 |

---

## 2. 步骤一：前端上传文件

用户在 `/rag` 选文件，原生 `<form>` + `FormData` 提交到 `/api/rag/upload`。可选勾选「上传前清空旧知识库」。

```ts
// components/Rag/index.tsx — handleUpload
const body = new FormData();
body.append("file", file);
if (clearBeforeUpload) body.append("clear", "1");

const res = await fetch(API_ROUTES.RAG_UPLOAD, { method: "POST", body });
const json = await res.json();
// json.data: { source, addedChunks, chunkCount, sources }
```

对应 API 常量：`API_ROUTES.RAG_UPLOAD` → `"/api/rag/upload"`。

---

## 3. 步骤二：服务端校验并读成文本

`POST /api/rag/upload` 解析 `multipart/form-data`：

- 字段名必须是 `file`
- 扩展名仅 `.txt` / `.md` / `.markdown`
- 大小 ≤ 1MB
- `clear=1` 时先 `clearRagStore()`
- `await file.text()` 得到字符串，交给 `ingestText(text, file.name)`

```ts
// app/api/rag/upload/route.ts
const form = await request.formData();
const file = form.get("file");
const clear = form.get("clear");

if (!(file instanceof File)) {
  return errorResponse("请上传文件（字段名 file）", -1, 400);
}

const name = file.name.toLowerCase();
const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
if (!ALLOWED_EXT.has(ext)) {
  return errorResponse("仅支持 .txt / .md / .markdown", -1, 400);
}
if (file.size > MAX_BYTES) {
  return errorResponse("文件不能超过 1MB", -1, 400);
}

if (clear === "1" || clear === "true") {
  clearRagStore();
}

const text = await file.text();
const data = await ingestText(text, file.name);
return successResponse(data, "上传并索引成功");
```

---

## 4. 步骤三：文本切分（Chunking）

入口 `ingestText` → `splitText`。固定字符窗口 + overlap，避免整篇塞上下文、也减轻关键句被切碎。

- `chunkSize = 400`：每块约 400 字符  
- `overlap = 60`：相邻块重叠 60 字符  

```ts
// lib/server/rag.ts — splitText
function splitText(text: string, chunkSize = 400, overlap = 60): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    if (end >= cleaned.length) break;
    start = end - overlap; // 下一步往回叠 overlap
  }
  return chunks;
}
```

示意图（字符下标）：

```
[0 -------- 400]
         [340 -------- 740]
                  [680 -------- ...]
         overlap=60
```

---

## 5. 步骤四：嵌入（Embedding）并写入内存库

嵌入模型固定走本地 Ollama（与对话 provider 无关）。`embedDocuments` 把每段文本变成向量；问答时 `embedQuery` 必须用**同一个**嵌入模型，否则相似度无意义。

内存结构：

```ts
// lib/server/rag.ts
type StoredChunk = {
  content: string;
  embedding: number[];
  source: string; // 文件名，便于溯源
};

const store: StoredChunk[] = [];

const embeddings = new OllamaEmbeddings({
  model: modelConfig.ollama.embedModel, // 默认 mxbai-embed-large:latest
  baseUrl: modelConfig.ollama.host,
});
```

入库：

```ts
// lib/server/rag.ts — ingestText
export async function ingestText(text: string, source: string) {
  const chunks = splitText(text);
  if (chunks.length === 0) {
    throw new Error("文件内容为空");
  }

  const vectors = await embeddings.embedDocuments(chunks);

  for (let i = 0; i < chunks.length; i++) {
    store.push({
      content: chunks[i]!,
      embedding: vectors[i]!,
      source,
    });
  }

  return {
    source,
    addedChunks: chunks.length,
    ...getRagStatus(), // { chunkCount, sources }
  };
}
```

至此「知识库」建好：进程内的 `store[]`。刷新状态可用 `GET /api/rag/status` → `getRagStatus()`。

---

## 6. 步骤五：相似度检索（可单独试玩）

左侧「检索试玩」调用 `POST /api/rag/search`，body：`{ query, k? }`（默认 k=4）。  
RAG Chat 内部也会走同一套 `searchRag`。

算法：问题 → `embedQuery` → 与每条 `chunk.embedding` 算**余弦相似度** → 降序取 Top-K。

\[
\text{score} = \frac{a \cdot b}{\|a\|\|b\|}
\]

```ts
// lib/server/rag.ts — cosineSimilarity + searchRag
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function searchRag(query: string, k = 4): Promise<RagHit[]> {
  if (store.length === 0) {
    throw new Error("知识库为空，请先上传文件");
  }

  const q = await embeddings.embedQuery(query);

  return store
    .map((chunk) => ({
      content: chunk.content,
      source: chunk.source,
      score: cosineSimilarity(q, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(k, store.length));
}
```

API 层：

```ts
// app/api/rag/search/route.ts
const hits = await searchRag(query, k);
return successResponse({ hits, query });
```

前端展示排名、`相似度 xx.x%`、进度条与原文片段（见 `components/Rag/index.tsx` 的 `handleSearch` + `hits.map`）。

---

## 7. 步骤六：RAG Chat — 检索结果注入提示词

用户在右侧输入问题 → `useStreamingChat` POST `/api/rag/chat`。

```ts
// components/Rag/index.tsx
useStreamingChat<ChatMessage>({
  apiRoute: API_ROUTES.RAG_CHAT,
  buildBody: (text) => ({ msg: text, ...chatModelPayload() }),
  onResponse: (response, { updateMessage }) => {
    const hitsHeader = response.headers.get("X-Rag-Hits");
    if (!hitsHeader) return;
    const chatHits = JSON.parse(decodeURIComponent(hitsHeader)) as RagHit[];
    updateMessage((msg) => ({ ...msg, hits: chatHits }));
  },
});
```

`chatModelPayload()` 从设置页读出 `provider` / `apiKey` / `model`，一并传给服务端。

路由：

```ts
// app/api/rag/chat/route.ts
const { stream, hits } = await streamRagChat(
  msg.trim(),
  request.signal,
  parseModelOptions(body),
);

return new Response(stream, {
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Rag-Hits": encodeURIComponent(JSON.stringify(hits)),
    "Access-Control-Expose-Headers": "X-Rag-Hits",
  },
});
```

核心：`streamRagChat` = **先检索，再生成**。

```ts
// lib/server/rag.ts — streamRagChat
export async function streamRagChat(
  msg: string,
  signal?: AbortSignal,
  modelOptions?: ChatModelOptions,
) {
  const hits = await searchRag(msg, 4);

  const context = hits
    .map(
      (h, i) =>
        `[片段${i + 1} | 相似度 ${(h.score * 100).toFixed(1)}% | 来源 ${h.source}]\n${h.content}`,
    )
    .join("\n\n");

  const systemMessage = `你是知识库问答助手。请严格依据「检索上下文」回答用户问题；若上下文不足以回答，请明确说不知道，不要编造。

检索上下文：
${context}`;

  const chatModel = createChatModel(modelOptions);
  const stream = await chatModel.stream([
    new SystemMessage(systemMessage),
    new HumanMessage(msg),
  ]);
  // ... 见下一步：把 stream 转成 ReadableStream
  return { stream: readable, hits };
}
```

发给 LLM 的消息形态：

```
SystemMessage:
  你是知识库问答助手。请严格依据「检索上下文」回答……
  检索上下文：
  [片段1 | 相似度 82.3% | 来源 notes.md]
  ……原文……

HumanMessage:
  用户的问题
```

生成模型由 `createChatModel` 决定（Ollama 或 DeepSeek）；**嵌入始终是 Ollama**。

---

## 8. 步骤七：流式输出文字到前端

服务端把 LangChain 的 token 流包装成 `ReadableStream`（`text/plain`）：

```ts
// lib/server/rag.ts — streamRagChat 内
const encoder = new TextEncoder();
const readable = new ReadableStream({
  async start(controller) {
    const onAbort = () => controller.close();
    signal?.addEventListener("abort", onAbort);
    try {
      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const text = toTextContent(chunk.content);
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    } catch (error) {
      if (!signal?.aborted) controller.error(error);
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  },
});
```

前端 `hooks/useStreamingChat`：`fetch` → 先用 `onResponse` 解析 `X-Rag-Hits` → `response.body.getReader()` 循环 `read()`，把解码后的文本追加到对应 AI 消息的 `content`。

```ts
// hooks/useStreamingChat/index.ts（读流核心）
const reader = response.body.getReader();
readerRef.current = reader;
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const piece = decoder.decode(value, { stream: true });
  if (piece) {
    updateMessage(aiMsgId, (msg) => ({
      ...msg,
      content: msg.content + piece,
    }));
  }
}
```

UI：`MsgBlock` 用 markdown-it 渲染 AI 气泡；每条 AI 消息下可用 `<details>` 展开「本次检索」看相似度与原文（`components/Rag/index.tsx`）。

---

## 9. 端到端对照表

| 顺序 | 发生什么 | 关键入口 |
|------|----------|----------|
| 1 | 用户选文件并提交 | `Rag.handleUpload` |
| 2 | 校验 + 读文本 | `POST /api/rag/upload` |
| 3 | 切块 | `splitText` |
| 4 | 嵌入并入库 | `ingestText` → `store.push` |
| 5a |（可选）只看检索 | `POST /api/rag/search` → `searchRag` |
| 5b | 用户提问 | `useStreamingChat` → `POST /api/rag/chat` |
| 6 | 问题向量化 + Top-K | `searchRag` |
| 7 | 拼 System Prompt + LLM stream | `streamRagChat` |
| 8 | 前端增量渲染文字 + 展示 hits | `useStreamingChat` + `MsgBlock` |

---

## 10. 页面上怎么验证

1. 准备短 `.md`，写几段互不相同的事实（项目名、端口、模型名等）  
2. 勾选「上传前清空旧知识库」→ 上传并索引  
3. 左侧关键词检索：Top 结果相似度应明显高于无关内容  
4. 右侧问文档里的事实；点开「本次检索」核对分数与原文  
5. 问文档里没有的事，模型应倾向于说「不知道」（system 约束）

---

## 11. 局限与下一步

| 现状 | 若要升级 |
|------|----------|
| 内存库，热重载清空 | Chroma / pgvector / LanceDB 持久化 |
| 仅 txt/md | PDFLoader 等解析更多格式 |
| 线性扫描全部向量 | ANN 索引（体量大时） |
| 单轮问答 | 带历史的多轮 + 会话级过滤 |
| 无重排序 | 检索后再用 cross-encoder rerank |

学习目标链路已跑通：**上传 → 切分 → 嵌入 → 相似度排序 → 注入提示词 → 流式生成**。

---

## 12. 相关配置

```bash
pnpm dev
# 可选环境变量（覆盖 config.ts）
# OLLAMA_HOST=http://localhost:11434
# OLLAMA_CHAT_MODEL=qwen3.5:4b
# OLLAMA_EMBED_MODEL=mxbai-embed-large:latest
# OLLAMA_TEMPERATURE=0.3
# DEEPSEEK_API_KEY=...   # 设置页未填 Key 时的服务端兜底
```

API 路径见 `constants/api.routes.ts`：`RAG_UPLOAD` / `RAG_SEARCH` / `RAG_CHAT` / `RAG_STATUS`。
