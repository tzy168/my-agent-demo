import { OllamaEmbeddings } from "@langchain/ollama";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { modelConfig } from "@/config";
import type { ChatHistoryItem } from "@/types/chat";
import { createChatModel, type ChatModelOptions } from "./model";
import { toLangChainHistory } from "./messages";

/** 内存中的一条文本块 + 向量（demo 用，进程重启即清空） */
type StoredChunk = {
  content: string;
  embedding: number[];
  source: string;
};

const store: StoredChunk[] = [];

// 嵌入仍走本地 Ollama；对话生成可按设置切换 DeepSeek
// 创建嵌入模型
const embeddings = new OllamaEmbeddings({
  model: modelConfig.ollama.embedModel,
  baseUrl: modelConfig.ollama.host,
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

/**
 *  按字符切块；overlap 保留上下文衔接 
 *  @param text 文本
 *  @param chunkSize 每个块的大小
 *  @param overlap 重叠的大小
 *  @returns 切块后的文本
 */
function splitText(text: string, chunkSize = 400, overlap = 60): string[] {
  console.log('Rag upload step 3：splitText');

  // 文本规范化 把 Windows 换行 \r\n 统一成 Unix 换行 \n
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  // 如果文本长度小于等于 chunkSize，则直接返回
  if (cleaned.length <= chunkSize) return [cleaned];

  // 切小是为了能嵌、能检；重叠是为了切点不断义
  // 滑动窗口切块
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    // 计算当前块的结束位置
    const end = Math.min(start + chunkSize, cleaned.length);
    // 将当前块添加到结果数组中
    chunks.push(cleaned.slice(start, end));
    // 如果当前块的结束位置大于等于文本长度，则跳出循环
    if (end >= cleaned.length) break;
    // 计算下一个块的开始位置
    start = end - overlap;
  }
  // 返回切块后的文本
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
  console.log('Rag upload step 2：ingestText');

  // 获取切块后的文本，滑动窗口切块
  const chunks = splitText(text);
  if (chunks.length === 0) {
    throw new Error("文件内容为空");
  }


  console.log('Rag upload step 4：embeddings');
  // 把每段文本变成向量（embedding）
  const vectors = await embeddings.embedDocuments(chunks);
  console.log("🚀 ~ ingestText ~ vectors:", vectors)

  console.log('Rag upload step 5：store');
  // 把每段文本和对应的向量存入内存
  for (let i = 0; i < chunks.length; i++) {
    store.push({
      content: chunks[i]!,
      embedding: vectors[i]!, // 向量
      source, // 来源
    });
  }
  // 返回结果
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

/** 
 * 向量检索 Top-K，返回带相似度的片段 
 * @param query 查询词
 * @param k 返回的相似度片段数量
 * @returns 带相似度的片段
 */
export async function searchRag(query: string, k = 4): Promise<RagHit[]> {
  console.log('Rag search step 1：searchRag');

  if (store.length === 0) {
    throw new Error("知识库为空，请先上传文件");
  }

  console.log('Rag search step 2：embeddings');
  const q = await embeddings.embedQuery(query);
  console.log("🚀 ~ searchRag ~ q:", q)
  return store
    .map((chunk) => ({
      content: chunk.content,// 内容
      source: chunk.source,// 来源
      score: cosineSimilarity(q, chunk.embedding),// 相似度
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(k, store.length));
}

/**
 * RAG 对话：先检索再生成，返回纯文本流
 * 同时把检索命中塞进响应头 X-Rag-Hits（JSON），方便前端展示相似度
 */
export async function streamRagChat(
  msg: string,
  signal?: AbortSignal,
  modelOptions?: ChatModelOptions,
  history: ChatHistoryItem[] = [],
) {
  // 检索仍只用本轮 msg；生成侧带上对话历史以支持追问
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
    ...toLangChainHistory(history),
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
