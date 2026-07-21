import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { modelConfig } from "@/config";

/** 内存中的一条文本块 + 向量（demo 用，进程重启即清空） */
type StoredChunk = {
  content: string;
  embedding: number[];
  source: string;
};

const store: StoredChunk[] = [];

const embeddings = new OllamaEmbeddings({
  model: modelConfig.ollama.embedModel,
  baseUrl: modelConfig.ollama.host,
});

const chatModel = new ChatOllama({
  model: modelConfig.ollama.chatModel,
  baseUrl: modelConfig.ollama.host,
  temperature: Number(modelConfig.ollama.temperature),
  think: false,
});

/** 余弦相似度：1 最相似，-1 最不相似 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** 按字符切块；overlap 保留上下文衔接 */
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
    start = end - overlap;
  }
  return chunks;
}

function toTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (
          block &&
          typeof block === "object" &&
          "text" in block &&
          typeof (block as { text: unknown }).text === "string"
        ) {
          return (block as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

/** 当前知识库状态 */
export function getRagStatus() {
  const sources = [...new Set(store.map((c) => c.source))];
  return { chunkCount: store.length, sources };
}

/** 清空知识库（便于重新上传） */
export function clearRagStore() {
  store.length = 0;
  return getRagStatus();
}

/**
 * 写入知识库：切分 → 嵌入 → 存内存
 * @param text 文件原文
 * @param source 文件名，便于溯源
 */
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
    ...getRagStatus(),
  };
}

export type RagHit = {
  content: string;
  source: string;
  /** 余弦相似度 0~1（通常），越高越相关 */
  score: number;
};

/** 向量检索 Top-K，返回带相似度的片段 */
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

/**
 * RAG 对话：先检索再生成，返回纯文本流
 * 同时把检索命中塞进响应头 X-Rag-Hits（JSON），方便前端展示相似度
 */
export async function streamRagChat(msg: string, signal?: AbortSignal) {
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

  const stream = await chatModel.stream([
    new SystemMessage(systemMessage),
    new HumanMessage(msg),
  ]);
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

  return { stream: readable, hits };
}
