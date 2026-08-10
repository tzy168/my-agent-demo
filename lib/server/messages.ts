import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatHistoryItem } from "@/types/chat";

/** 客户端 history 默认窗口：约 10 轮 */
const DEFAULT_HISTORY_MAX = 20;

/**
 * 校验并截断客户端传来的 history；非法项丢弃，超长从头部裁掉。
 * 不信任客户端长度 / role / content 形态。
 */
export function parseChatHistory(
  raw: unknown,
  max = DEFAULT_HISTORY_MAX,
): ChatHistoryItem[] {
  if (!Array.isArray(raw)) return [];

  const items: ChatHistoryItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    if (role !== "human" && role !== "ai") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    items.push({ role, content });
  }

  return items.length > max ? items.slice(-max) : items;
}

/** 把已校验的 history 转成 LangChain 消息（不含 System / 本轮 Human） */
export function toLangChainHistory(items: ChatHistoryItem[]): BaseMessage[] {
  return items.map((item) =>
    item.role === "human"
      ? new HumanMessage(item.content)
      : new AIMessage(item.content),
  );
}
