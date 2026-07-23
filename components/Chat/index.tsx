"use client";

import { useEffect, useRef, useState } from "react";
import { API_ROUTES } from "@/constants/api.routes";
import { chatModelPayload } from "@/lib/settings";
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
  const [systemPrompt, setSystemPrompt] = useState("");
  // 输入框前缀标签文案，与 systemPrompt 同步
  const [roleTag, setRoleTag] = useState("");
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
      const response = await fetch(API_ROUTES.BASE_CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msg: text,
          systemMsg: systemPrompt,
          ...chatModelPayload(),
        }),
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
    // 列布局：列表与发送框同处 chat-column，宽度一致
    <div className="chat-panel">
      <div className="chat-column">
        <div ref={listRef} className="chat-list">
          {messages.length === 0 && !loading && (
            <p className="chat-empty">发送一条消息开始对话</p>
          )}
          {messages.map((msg) => (
            <MsgBlock key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {loading && (
            <div className="msg-row-start">
              <div className="chat-typing">
                <span className="chat-typing-dot" aria-hidden />
                思考中…
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setRoleTag("前端");
              setSystemPrompt("你是一个前端工程师，请用前端视角回答问题");
            }}
          >
            前端
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setRoleTag("全栈");
              setSystemPrompt("你是一个全栈工程师，请用全栈视角回答问题");
            }}
          >
            全栈
          </button>
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          {roleTag ? (
            <span className="chat-input-tag" title={systemPrompt}>
              {roleTag}
              <button
                type="button"
                className="chat-input-tag-clear"
                aria-label={`清除${roleTag}标签`}
                onClick={() => {
                  setRoleTag("");
                  setSystemPrompt("");
                }}
              >
                ×
              </button>
            </span>
          ) : null}
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
              className="btn-primary chat-send"
            >
              发送
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default Chat;
