"use client";

import { useEffect, useRef, useState } from "react";
import { chatModelPayload } from "@/lib/settings";
import type { MsgRole } from "@/components/Chat/MsgBlock";

/** 流式对话的消息类型 */
export type StreamingChatMessage = {
  /** 消息 ID */
  id: string;
  /** 消息角色 */
  role: MsgRole;
  /** 消息内容 */
  content: string;
};

/** 流式对话的配置选项 */
type UseStreamingChatOptions<TMsg extends StreamingChatMessage> = {
  /** API 路由 */
  apiRoute: string;
  /** 拼 POST JSON body；默认 `{ msg, ...chatModelPayload() }` */
  buildBody?: (text: string) => Record<string, unknown>;
  /** 拿到 Response 后、读流前调用（如解析 X-Rag-Hits） */
  onResponse?: (
    response: Response,
    helpers: {
      aiMsgId: string;
      updateMessage: (updater: (msg: TMsg) => TMsg) => void;
    },
  ) => void;
};

/** Chat / Rag 共用的流式对话：消息列表、输入、Abort、ReadableStream 增量更新 */
const useStreamingChat = <TMsg extends StreamingChatMessage = StreamingChatMessage>(
  options: UseStreamingChatOptions<TMsg>,
) => {
  const { apiRoute, buildBody, onResponse } = options;

  const [messages, setMessages] = useState<TMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // 新消息追加后滚到底部
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // 卸载时取消进行中的请求 / 读流，避免 setState on unmounted
  useEffect(() => {
    return () => {
      void readerRef.current?.cancel().catch(() => { });
      abortControllerRef.current?.abort();
    };
  }, []);

  /** 更新消息 */
  const updateMessage = (aiMsgId: string, updater: (msg: TMsg) => TMsg) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === aiMsgId ? updater(msg) : msg)),
    );
  };

  /** 停止对话 */
  const handleAbort = () => {
    // 流已开始：只 cancel reader；仍在等待响应时才 abort fetch
    if (readerRef.current) {
      void readerRef.current.cancel().catch(() => { });
      return;
    }
    abortControllerRef.current?.abort();
  };

  /** 发送消息 */
  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const humanMsg = {
      id: `human-${Date.now()}`,
      role: "human" as const,
      content: text,
    } as TMsg;

    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      humanMsg,
      { id: aiMsgId, role: "ai" as const, content: "" } as TMsg,
    ]);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const body = buildBody?.(text) ?? { msg: text, ...chatModelPayload() };
      const response = await fetch(apiRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // 服务端错误仍走 JSON；成功时 body 是纯文本流
      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => null);
        throw new Error(
          typeof err?.message === "string" ? err.message : "请求失败",
        );
      }

      onResponse?.(response, {
        aiMsgId,
        updateMessage: (updater) => updateMessage(aiMsgId, updater),
      });

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let aiContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        aiContent += decoder.decode(value, { stream: true });
        updateMessage(aiMsgId, (msg) => ({ ...msg, content: aiContent }));
      }

      aiContent += decoder.decode();
      updateMessage(aiMsgId, (msg) => ({
        ...msg,
        content: aiContent || "（无回复）",
      }));
    } catch (error) {
      const isAborted =
        (error instanceof Error && error.name === "AbortError") ||
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && /aborted/i.test(error.message));

      if (isAborted) {
        // 用户主动停止：保留已生成的部分内容
        updateMessage(aiMsgId, (msg) =>
          !msg.content ? { ...msg, content: "（已停止）" } : msg,
        );
        return;
      }

      const errText =
        error instanceof Error ? error.message : "请求失败，请稍后重试。";
      updateMessage(aiMsgId, (msg) => ({ ...msg, content: errText }));
    } finally {
      abortControllerRef.current = null;
      readerRef.current = null;
      setLoading(false);
    }
  };

  return {
    messages,
    input,
    setInput,
    loading,
    listRef,
    handleAbort,
    handleSubmit,
  };
};

export default useStreamingChat;
