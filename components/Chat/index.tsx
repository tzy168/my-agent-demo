"use client";

import { useState } from "react";
import { API_ROUTES } from "@/constants/api.routes";
import { chatModelPayload } from "@/lib/settings";
import useStreamingChat from "@/hooks/useStreamingChat";
import MsgBlock from "./MsgBlock";

const Chat = () => {
  const [systemPrompt, setSystemPrompt] = useState("");
  // 输入框前缀标签文案，与 systemPrompt 同步
  const [roleTag, setRoleTag] = useState("");

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
    buildBody: (text) => ({
      msg: text,
      systemMsg: systemPrompt,
      ...chatModelPayload(),
    }),
  });

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
        <div
          className="flex gap-2"
          style={{ backdropFilter: "blur(5px)" }}
        >
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
