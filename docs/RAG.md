# RAG Demo：从 0 到 1

本文对应本仓库 `/rag` 页面与 `lib/server/rag.ts` 的实现，按真实执行顺序讲清楚每一步。

前置条件：本机已启动 [Ollama](https://ollama.com)，并拉取聊天模型与嵌入模型（见 `config.ts` / 环境变量）。

```bash
ollama pull qwen3.5:4b
ollama pull mxbai-embed-large:latest
pnpm dev
```

打开 http://localhost:3000/rag 即可试用。

---

## 0. RAG 在解决什么问题

大模型只「记住」训练数据，不了解你刚上传的私有文档。

**RAG（Retrieval-Augmented Generation）** 的做法是：

1. 先把文档变成可检索的知识库  
2. 用户提问时，先找出最相关的几段原文  
3. 把这些原文塞进提示词，再让模型回答  

这样答案有据可依，也减少胡编。

本 demo 刻意做「最小可用」：

| 环节 | 本项目做法 |
|------|------------|
| 文档格式 | 仅 `.txt` / `.md` |
| 向量库 | 进程内存数组（重启/热重载会清空） |
| 相似度 | 余弦相似度（越高越相关） |
| 生成 | Ollama + 流式纯文本，与 `/chat` 一致 |

---

## 1. 整体数据流

```
上传文件
  → 读成纯文本
  → 切成 chunk
  → OllamaEmbeddings 得到向量
  → 存入内存 store[]

用户检索 / 提问
  → 问题也变成向量
  → 与 store 里每条算余弦相似度，取 Top-K
  →（可选）把 Top-K 原文写入 System Prompt
  → ChatOllama 流式生成回答
```

关键文件：

| 文件 | 职责 |
|------|------|
| `lib/server/rag.ts` | 切分、嵌入、检索、RAG 流式对话 |
| `app/api/rag/upload/route.ts` | 接收文件并索引 |
| `app/api/rag/search/route.ts` | 只检索，返回相似度 |
| `app/api/rag/chat/route.ts` | 检索 + 生成（流式） |
| `app/api/rag/status/route.ts` | 当前库有多少块 |
| `components/Rag/index.tsx` | 上传 / 检索可视化 / RAG Chat UI |

---

## 2. 步骤一：上传与读文件

前端用原生 `<form>` + `<input type="file">`，`FormData` 提交到 `/api/rag/upload`。

服务端校验：

- 字段名必须是 `file`
- 扩展名仅 `.txt` / `.md` / `.markdown`
- 大小 ≤ 1MB（demo 限制）
- 可选 `clear=1`：上传前清空旧库，避免多次上传混在一起

然后 `await file.text()` 得到字符串，交给 `ingestText(text, file.name)`。

---

## 3. 步骤二：文本切分（Chunking）

长文不能整篇塞进模型上下文，也难做精准检索，所以要切块。

本项目在 `splitText` 里用**固定字符窗口 + overlap**：

- `chunkSize = 400`：每块大约 400 字符  
- `overlap = 60`：相邻块重叠 60 字符，减轻「关键句被切开」的问题  

生产环境常用 `RecursiveCharacterTextSplitter`（按段落/句子递归切），原理相同：小块 + 轻微重叠。

---

## 4. 步骤三：嵌入（Embedding）

调用 `@langchain/ollama` 的 `OllamaEmbeddings`：

```ts
const vectors = await embeddings.embedDocuments(chunks); // 文档块 → 向量数组
const q = await embeddings.embedQuery(query);            // 查询句 → 一个向量
```

嵌入模型（默认 `mxbai-embed-large`）把语义相近的句子映射到相近的向量空间。  
**问答两边必须用同一个嵌入模型**，否则相似度没有意义。

每条入库结构：

```ts
{ content: string; embedding: number[]; source: string }
```

`source` 保存文件名，方便前端展示「这段来自哪个文件」。

---

## 5. 步骤四：相似度检索

对查询向量 `q`，与库中每条 `chunk.embedding` 算**余弦相似度**：

\[
\text{score} = \frac{a \cdot b}{\|a\|\|b\|}
\]

- 范围大约在 `-1 ~ 1`，本场景通常接近 `0 ~ 1`  
- **越大越相关**  
- 按 score 降序，取 Top-K（默认 4）

对应 API：`POST /api/rag/search`，body：`{ query, k? }`。

前端「检索试玩」区会展示：

- 排名 `#1 #2 …`
- `相似度 xx.x%`
- 进度条（视觉化 score）
- 原文片段与来源文件名

这就是「检索出来的内容的相似度」——没有黑盒，分数就是余弦相似度。

---

## 6. 步骤五：结合 RAG 做 Chat

`POST /api/rag/chat`，body：`{ msg }`。

服务端流程：

1. `searchRag(msg, 4)` 拿到命中片段  
2. 拼进 System Prompt，例如：

```text
你是知识库问答助手。请严格依据「检索上下文」回答……
检索上下文：
[片段1 | 相似度 82.3% | 来源 notes.md]
……
```

3. `ChatOllama.stream([SystemMessage, HumanMessage])` 流式输出  
4. 响应体是 `text/plain` 流；响应头 `X-Rag-Hits` 带上本次命中 JSON（含 score），供 UI 展开查看

前端复用 Chat 页同一套 `getReader()` 流式更新逻辑；每条 AI 消息下用 `<details>` 展示引用与相似度。

---

## 7. 你在页面上怎么验证

1. 准备一个短 `.md`，写几段互不相同的事实（比如项目名、端口、模型名）  
2. 勾选「上传前清空旧知识库」→ 上传并索引  
3. 在左侧用关键词检索，确认 Top 结果相似度明显高于无关内容  
4. 在右侧提问文档里的事实，答案应引用知识库；点开「本次检索」核对分数与原文  
5. 问文档里没有的事，模型应倾向于说「不知道」（由 system 约束）

---

## 8. 局限与下一步（刻意没做的）

| 现状 | 若要升级 |
|------|----------|
| 内存库，热重载清空 | Chroma / pgvector / LanceDB 持久化 |
| 仅 txt/md | PDFLoader 等解析更多格式 |
| 线性扫描全部向量 | 真正的 ANN 索引（体量大时） |
| 单轮问答 | 带历史的多轮 + 会话级过滤 |
| 无重排序 | 检索后再用 cross-encoder rerank |

对本仓库的学习目标来说：**上传 → 切分 → 嵌入 → 相似度排序 → 注入提示词 → 流式生成** 这条链已经跑通，其余都是工程化增强。

---

## 9. 相关命令与配置

```bash
pnpm dev          # 开发
# 环境变量（可选，覆盖 config.ts 默认值）
# OLLAMA_HOST=http://localhost:11434
# OLLAMA_CHAT_MODEL=qwen3.5:4b
# OLLAMA_EMBED_MODEL=mxbai-embed-large:latest
# OLLAMA_TEMPERATURE=0.3
```

API 路径常量见 `constants/api.routes.ts`：`RAG_UPLOAD` / `RAG_SEARCH` / `RAG_CHAT` / `RAG_STATUS`。
