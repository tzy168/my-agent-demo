"use client";

import { useEffect, useRef, useState } from "react";
import { API_ROUTES } from "@/constants/api.routes";
import MsgBlock, { type MsgRole } from "./MsgBlock";

type ChatMessage = {
  id: string;
  role: MsgRole;
  content: string;
};

const Chat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // 当前请求的 AbortController，用于停止生成
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // 新消息追加后滚到底部，保证最新对话可见
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleAbort = () => {
    // 流已开始：只 cancel reader；仍在等待响应时才 abort fetch
    if (readerRef.current) {
      void readerRef.current.cancel().catch(() => { });
      return;
    }
    abortControllerRef.current?.abort();
  };

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const humanMsg: ChatMessage = {
      id: `human-${Date.now()}`,
      role: "human",
      content: text,
    };

    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      humanMsg,
      { id: aiMsgId, role: "ai", content: "" },
    ]);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(API_ROUTES.PIPE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg: text }),
        signal: controller.signal,
      });

      // 服务端错误仍走 JSON；成功时 body 是纯文本流
      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => null);
        throw new Error(
          typeof err?.message === "string" ? err.message : "请求失败",
        );
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let aiContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        aiContent += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, content: aiContent } : msg,
          ),
        );
      }

      aiContent += decoder.decode();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? { ...msg, content: aiContent || "（无回复）" }
            : msg,
        ),
      );
    } catch (error) {
      const isAborted =
        (error instanceof Error && error.name === "AbortError") ||
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && /aborted/i.test(error.message));

      if (isAborted) {
        // 用户主动停止：保留已生成的部分内容
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId && !msg.content
              ? { ...msg, content: "（已停止）" }
              : msg,
          ),
        );
        return;
      }

      const errText =
        error instanceof Error ? error.message : "请求失败，请稍后重试。";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId ? { ...msg, content: errText } : msg,
        ),
      );
    } finally {
      abortControllerRef.current = null;
      readerRef.current = null;
      setLoading(false);
    }
  };

  return (
    // 列布局：消息区可滚、输入框始终贴底；整页不滚动
    <div className="chat-panel">
      <div ref={listRef} className="chat-list" style={{
        height: 'calc(100vh - 200px)',
      }}>
        {messages.length === 0 && !loading && (
          <p className="chat-empty">发送一条消息开始对话</p>
        )}
        {messages.map((msg) => (
          <MsgBlock key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {loading && (
          <div className="msg-row-start">
            <div className="chat-typing">思考中…</div>
          </div>
        )}
      </div>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          name="message"
          type="text"
          disabled={loading}
          className="chat-input"
          autoComplete="off"
          placeholder="请输入消息"
        />
        {loading ? (
          <button
            type="button"
            onClick={handleAbort}
            className="chat-stop"
          >
            停止
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="chat-send"
          >
            发送
          </button>
        )}
      </form>
    </div>
  );
};

export default Chat;
