"use client";

import { useEffect, useState } from "react";
import { API_ROUTES } from "@/constants/api.routes";
import {
  SETTINGS_EVENT,
  chatModelPayload,
  readSettings,
  writeSettings,
} from "@/lib/settings";
import useStreamingChat from "@/hooks/useStreamingChat";
import {
  type DeepSeekModel,
  type LlmProvider,
} from "@/types/settings";
import MsgBlock from "./MsgBlock";
import { ModelSelect } from "./ModelSelect";

type ChatRole = "frontend" | "fullstack";

const ROLE_PROMPTS: Record<ChatRole, string> = {
  frontend: "你是一个前端工程师，请用前端视角回答问题",
  fullstack: "你是一个全栈工程师，请用全栈视角回答问题",
};

const Chat = () => {
  const [role, setRole] = useState<ChatRole | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [provider, setProvider] = useState<LlmProvider>("ollama");
  const [deepseekModel, setDeepseekModel] =
    useState<DeepSeekModel>("deepseek-v4-flash");

  useEffect(() => {
    const sync = () => {
      const s = readSettings();
      setProvider(s.provider);
      setDeepseekModel(s.deepseekModel);
    };
    sync();
    window.addEventListener(SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const {
    messages,
    input,
    setInput,
    loading,
    listRef,
    handleAbort,
    handleSubmit,
  } = useStreamingChat({
    apiRoute: API_ROUTES.BASE_CHAT,
    buildBody: (text, priorMessages) => ({
      msg: text,
      history: priorMessages
        .filter((m) => m.content.trim())
        .map(({ role, content }) => ({ role, content })),
      systemMsg: role ? ROLE_PROMPTS[role] : "",
      webSearch,
      ...chatModelPayload(),
    }),
  });

  /** 前端 / 全栈互斥；再点一次取消 */
  const toggleRole = (next: ChatRole) => {
    setRole((prev) => (prev === next ? null : next));
  };

  const onModelChange = (model: DeepSeekModel) => {
    setDeepseekModel(model);
    writeSettings({ ...readSettings(), deepseekModel: model });
  };

  return (
    // 列布局：列表与发送框同处 chat-column，宽度一致
    <div className="chat-panel">
      <div className="chat-column">
        <div ref={listRef} className="chat-list">
          {messages.length === 0 && !loading && (
            <p className="chat-empty">发送一条消息开始对话</p>
          )}
          {messages.map((msg, index) => (
            <MsgBlock
              key={msg.id}
              role={msg.role}
              content={msg.content}
              loading={loading && msg.role === 'ai' && index === messages.length - 1}
            />
          ))}
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter 发送，Shift+Enter 换行
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!loading && input.trim()) void handleSubmit();
              }
            }}
            name="message"
            rows={1}
            disabled={loading}
            className="chat-input"
            autoComplete="off"
            placeholder="请输入消息"
          />
          <div className="chat-form-bar">
            <div className="chat-roles">
              {provider === "deepseek" ? (
                <ModelSelect
                  value={deepseekModel}
                  disabled={loading}
                  onChange={onModelChange}
                />
              ) : null}
              <button
                type="button"
                className="chat-role-btn"
                aria-pressed={role === "frontend"}
                onClick={() => toggleRole("frontend")}
              >
                前端
              </button>
              <button
                type="button"
                className="chat-role-btn"
                aria-pressed={role === "fullstack"}
                onClick={() => toggleRole("fullstack")}
              >
                全栈
              </button>
              <button
                type="button"
                className="chat-role-btn"
                aria-pressed={webSearch}
                onClick={() => setWebSearch((v) => !v)}
              >
                联网搜索
              </button>
            </div>
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chat;
