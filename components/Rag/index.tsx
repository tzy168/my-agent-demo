"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { API_ROUTES } from "@/constants/api.routes";
import MsgBlock, { type MsgRole } from "@/components/Chat/MsgBlock";
// 样式见 ./rag.css（由 app/globals.css 统一 import，保证 Tailwind @utility 生效）

type RagHit = {
  content: string;
  source: string;
  score: number;
};

type ChatMessage = {
  id: string;
  role: MsgRole;
  content: string;
  hits?: RagHit[];
};

type RagStatus = {
  chunkCount: number;
  sources: string[];
};

const Rag = () => {
  const [status, setStatus] = useState<RagStatus>({ chunkCount: 0, sources: [] });
  const [clearBeforeUpload, setClearBeforeUpload] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<RagHit[]>([]);
  const [searchError, setSearchError] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const refreshStatus = async () => {
    try {
      const res = await fetch(API_ROUTES.RAG_STATUS);
      const json = await res.json();
      if (json.code === 0) setStatus(json.data);
    } catch {
      // 状态拉取失败不阻断主流程
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    setUploadMsg("");
    try {
      const body = new FormData();
      body.append("file", file);
      if (clearBeforeUpload) body.append("clear", "1");

      const res = await fetch(API_ROUTES.RAG_UPLOAD, { method: "POST", body });
      const json = await res.json();
      if (json.code !== 0) throw new Error(json.message || "上传失败");

      setStatus({
        chunkCount: json.data.chunkCount,
        sources: json.data.sources,
      });
      setUploadMsg(
        `已索引「${json.data.source}」：新增 ${json.data.addedChunks} 块，库中共 ${json.data.chunkCount} 块`,
      );
      form.reset();
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || searching) return;

    setSearching(true);
    setSearchError("");
    setHits([]);
    try {
      const res = await fetch(API_ROUTES.RAG_SEARCH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, k: 4 }),
      });
      const json = await res.json();
      if (json.code !== 0) throw new Error(json.message || "检索失败");
      setHits(json.data.hits ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "检索失败");
    } finally {
      setSearching(false);
    }
  };

  const handleAbort = () => {
    if (readerRef.current) {
      void readerRef.current.cancel().catch(() => {});
      return;
    }
    abortControllerRef.current?.abort();
  };

  const handleChat = async () => {
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
      const response = await fetch(API_ROUTES.RAG_CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg: text }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => null);
        throw new Error(
          typeof err?.message === "string" ? err.message : "请求失败",
        );
      }

      // 从响应头解析本次检索命中（含相似度）
      const hitsHeader = response.headers.get("X-Rag-Hits");
      let chatHits: RagHit[] | undefined;
      if (hitsHeader) {
        try {
          chatHits = JSON.parse(decodeURIComponent(hitsHeader)) as RagHit[];
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId ? { ...msg, hits: chatHits } : msg,
            ),
          );
        } catch {
          // 忽略解析失败
        }
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
    <div className="rag-page">
      <div className="rag-grid">
        {/* 左栏：上传 + 检索（仅 rag-hits 滚动） */}
        <section className="rag-side">
          <header className="rag-section-head">
            <h2 className="rag-title">知识库</h2>
            <p className="rag-meta">
              {status.chunkCount > 0
                ? `${status.chunkCount} 块 · ${status.sources.join(", ") || "无来源"}`
                : "尚未上传文档"}
            </p>
          </header>

          <form className="rag-form" onSubmit={handleUpload}>
            <label className="rag-label" htmlFor="rag-file">
              上传文档（.txt / .md）
            </label>
            <input
              id="rag-file"
              name="file"
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              className="rag-file"
              required
              disabled={uploading}
            />
            <label className="rag-check">
              <input
                type="checkbox"
                checked={clearBeforeUpload}
                onChange={(e) => setClearBeforeUpload(e.target.checked)}
                disabled={uploading}
              />
              上传前清空旧知识库
            </label>
            <button type="submit" className="rag-btn" disabled={uploading}>
              {uploading ? "索引中…" : "上传并索引"}
            </button>
            {uploadMsg && <p className="rag-hint" role="status">{uploadMsg}</p>}
          </form>

          <form className="rag-form" onSubmit={handleSearch}>
            <label className="rag-label" htmlFor="rag-query">
              检索试玩（看相似度）
            </label>
            <div className="rag-row">
              <input
                id="rag-query"
                name="query"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="rag-input"
                placeholder="输入问题或关键词"
                disabled={searching}
                autoComplete="off"
              />
              <button
                type="submit"
                className="rag-btn"
                disabled={searching || !query.trim()}
              >
                {searching ? "检索中…" : "检索"}
              </button>
            </div>
            {searchError && (
              <p className="rag-hint rag-hint-error" role="alert">
                {searchError}
              </p>
            )}
          </form>

          <div className="rag-hits">
            {hits.length === 0 && !searchError && (
              <p className="rag-empty">检索结果会显示在这里，并标出相似度</p>
            )}
            {hits.map((hit, i) => (
              <article key={`${hit.source}-${i}`} className="rag-hit">
                <div className="rag-hit-head">
                  <span className="rag-hit-rank">#{i + 1}</span>
                  <span className="rag-hit-score">
                    相似度 {(hit.score * 100).toFixed(1)}%
                  </span>
                  <span className="rag-hit-source">{hit.source}</span>
                </div>
                <div
                  className="rag-hit-bar"
                  style={{ ["--score" as string]: `${Math.max(0, Math.min(1, hit.score)) * 100}%` }}
                />
                <pre className="rag-hit-body">{hit.content}</pre>
              </article>
            ))}
          </div>
        </section>

        {/* 右栏：RAG Chat */}
        <section className="rag-chat">
          <header className="rag-section-head">
            <h2 className="rag-title">RAG Chat</h2>
            <p className="rag-meta">先检索知识库，再基于命中片段回答</p>
          </header>

          <div ref={listRef} className="rag-chat-list">
            {messages.length === 0 && !loading && (
              <p className="chat-empty">上传文档后，在这里基于知识库提问</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="rag-msg-wrap">
                <MsgBlock role={msg.role} content={msg.content} />
                {msg.role === "ai" && msg.hits && msg.hits.length > 0 && (
                  <details className="rag-cite">
                    <summary>
                      本次检索 {msg.hits.length} 条（点开看相似度）
                    </summary>
                    <ul className="rag-cite-list">
                      {msg.hits.map((h, i) => (
                        <li key={i}>
                          <strong>{(h.score * 100).toFixed(1)}%</strong>
                          {" · "}
                          {h.source}
                          <pre className="rag-cite-snippet">{h.content}</pre>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
            {loading && (
              <div className="msg-row-start">
                <div className="chat-typing">
                  <span className="chat-typing-dot" aria-hidden />
                  检索并思考中…
                </div>
              </div>
            )}
          </div>

          <form
            className="chat-form rag-chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleChat();
            }}
          >
            <label className="sr-only" htmlFor="rag-chat-input">
              消息
            </label>
            <input
              id="rag-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              name="message"
              type="text"
              disabled={loading}
              className="chat-input"
              autoComplete="off"
              placeholder="基于知识库提问…"
            />
            {loading ? (
              <button type="button" onClick={handleAbort} className="chat-stop">
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
        </section>
      </div>
    </div>
  );
};

export default Rag;
