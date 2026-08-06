# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An AI agent demo built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4. Uses LangChain + Ollama for local LLM chat with streaming responses, optional DeepSeek (OpenAI-compatible) as a second provider, LangChain tool-calling (`web_search` / `get_now_time`) for a "network search" toggle, in-memory RAG, and OGL (WebGL) + GSAP animated backgrounds. The goal is to learn AI Agent development (see `ROADMAP.md` for the 6-stage learning plan).

## Essential Commands

This project uses **pnpm** as its package manager. Do not use npm or yarn.

```bash
pnpm dev      # Start dev server (http://localhost:3000) AND runs `ollama run qwen3.5:4b` in parallel
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

No test suite is configured yet.

## Architecture

### Routing (Next.js App Router)

Routes use the `(main)` route group with a shared layout (`app/(main)/layout.tsx`) that wraps all pages in `NavTabs`. The route group itself doesn't affect URL paths.

| Path | Page | Purpose |
|------|------|---------|
| `/` | `app/(main)/page.tsx` | Home — Grainient WebGL gradient hero + GSAP scroll animations + CubeParticles |
| `/chat` | `app/(main)/chat/page.tsx` | Streaming AI chat with role toggle + 联网搜索 toggle |
| `/rag` | `app/(main)/rag/page.tsx` | RAG demo：上传、相似度检索、RAG Chat（见 `docs/RAG.md`） |
| `/docs` | `app/(main)/docs/page.tsx` | Static docs on building RAG with this stack |
| `/settings` | `app/(main)/settings/page.tsx` | 设置：切换 Ollama / DeepSeek，填 DeepSeek API Key 与模型（localStorage） |

Top nav tabs are `HOME / CHAT / RAG / DOCS` — `/settings` is reached via a gear icon, not a tab (see `constants/app.routes.ts`).

### API Routes

Two streaming endpoints return plain-text `ReadableStream`s (not JSON). Errors from any endpoint return JSON `{ code, message, data }` via `errorResponse()`.

- **`/api/baseChat`** — Streaming chat with tool-calling loop. Accepts `{ msg, systemMsg, webSearch, provider?, apiKey? }`. When `webSearch` is true, the model is bound to both `web_search` and `get_now_time` tools; otherwise only `get_now_time`. Supports up to 3 rounds of tool calls (see `lib/server/chat.ts`).
- **`/api/pipe`** — LCEL chained chat with a hardcoded "senior programmer" system prompt. Accepts `{ msg, systemMsg, provider?, apiKey? }`. No tools.
- **`/api/rag/upload`** — Multipart upload (`.txt`/`.md`/`.markdown`, ≤1MB), chunk + embed into in-memory store. Optional `clear=1`.
- **`/api/rag/search`** — `{ query, k? }` → hits with cosine similarity scores (JSON `ApiResponse`).
- **`/api/rag/chat`** — RAG streaming chat；header `X-Rag-Hits` carries retrieval scores (URI-encoded JSON；response exposes it via `Access-Control-Expose-Headers`). Accepts `{ msg, provider?, apiKey? }`（生成模型可切换；嵌入仍 Ollama）.
- **`/api/rag/status`** — Current chunk count and sources.

### Directory Structure

```
app/                  # Next.js App Router (pages + API routes)
components/           # React components, barrel-exported from index.ts
  Chat/               # Streaming chat panel + MsgBlock
  Chat/MsgBlock/      # Single message bubble, markdown-it rendering, Loader while streaming
  Docs/               # Static documentation page
  Grainient/          # WebGL animated gradient (OGL) — heavy, keep client-only
  Home/               # Hero page wrapping Grainient + CubeParticles (GSAP scroll)
  Loader/             # styled-components 3D cube spinner, shown while awaiting first token
  NavTabs.tsx         # Top navigation bar with route-aware active state
  Rag/                # RAG：上传、检索相似度、RAG Chat
  Settings/           # 设置页：Ollama / DeepSeek + API Key + 模型
hooks/
  useStreamingChat/   # Shared streaming-chat hook (Chat + Rag both use it)
lib/
  api/                # Client-side fetch wrapper (ApiClient class)
  server/             # Server-only: model factory, chat, rag, tools, response helpers
    tools/            # Agent tools（LangChain tool / function calling）
  settings.ts         # 前端设置读写（localStorage）+ chatModelPayload()
constants/
  api.routes.ts       # API route path constants
  app.routes.ts       # Page route constants, NavTab config, active-tab logic
types/
  api.ts              # ApiResponse<T> interface
  settings.ts         # AppSettings / LlmProvider / DeepSeekModel
config.ts             # Ollama + DeepSeek model config — driven by env vars
```

### Key Patterns

- **Barrel exports**: `components/index.ts` and `lib/server/index.ts` re-export public APIs. Import from `@/components` or `@/lib/server`.
- **Path aliases**: `@/*` maps to project root (configured in `tsconfig.json`).
- **CSS utilities**: Component styles are defined as Tailwind v4 `@utility` classes in `app/globals.css` plus per-component `.css` files (`components/Chat/chat.css`, `components/Rag/rag.css`, `styles/*.css`, etc.). Do not use inline Tailwind classes directly — use the utility classes (e.g., `chat-panel`, `msg-bubble-ai`, `nav-glass`). Design tokens (colors/fonts, light/dark themes) live in `styles/tokens.css`, see `DESIGN.md`.
- **Client/Server separation**: Components using hooks, browser APIs, or WebGL are marked `"use client"`. Server-only code lives in `lib/server/` and must not be imported in client components.
- **Shared streaming hook**: Both `Chat` and `Rag` get streaming, abort, and auto-scroll from `hooks/useStreamingChat/index.ts` — do not reimplement per-component streaming. `onResponse` reads headers (e.g. `X-Rag-Hits`) before the body stream is consumed. Abort semantics: `handleAbort` cancels the reader if the stream started, otherwise aborts the fetch.
- **Streaming responses**: Chat API endpoints return `ReadableStream` with `text/plain` content type. The front-end reads via `response.body.getReader()` and incrementally updates UI. AbortController cancels both the fetch and the reader.
- **ApiClient**: A fetch wrapper in `lib/api/client.ts` for JSON APIs expecting `ApiResponse<T>` shape (`{ code: 0, message, data }`). Not used by the chat page (which uses raw fetch for streaming).

### Model Configuration

All model config lives in `config.ts` and reads from environment variables.

**Ollama（默认 / RAG 嵌入）**

- `OLLAMA_HOST` — Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_CHAT_MODEL` — chat model (default: `qwen3.5:4b`)
- `OLLAMA_EMBED_MODEL` — embedding model for RAG (default: `mxbai-embed-large:latest`)
- `OLLAMA_TEMPERATURE` — model temperature (default: `0.3`)

**DeepSeek（可选，OpenAI 兼容 API）**

- 设置页可切换 provider，并填写 API Key（存 localStorage，请求时随 body 传给服务端）
- `DEEPSEEK_API_KEY` — 服务端兜底 Key（未在设置页填写时使用）
- `DEEPSEEK_BASE_URL` — default `https://api.deepseek.com`
- `DEEPSEEK_CHAT_MODEL` — default `deepseek-v4-flash`
- `DEEPSEEK_TEMPERATURE` — default `0.3`
- 聊天生成走 `createChatModel()`；RAG 向量嵌入仍固定使用 Ollama

The model factory `lib/server/model.ts` is the single place models are created: `createChatModel({ provider, apiKey })` returns a `ChatOllama` or a `ChatOpenAI` (DeepSeek). `parseModelOptions(body)` reads `provider`/`apiKey` from a request body, ignoring illegal values. Embeddings always use Ollama. Agent tools (`lib/server/tools/`) are only imported server-side.

### Important: Next.js 16 Breaking Changes

This project uses **Next.js 16.2.10**, which has breaking API changes vs. earlier versions. Before writing any Next.js-specific code, consult the guides in `node_modules/next/dist/docs/` — they are the authoritative reference and override any assumptions from training data.

### Markdown Rendering in Chat

Messages are rendered via `markdown-it` with `html: false` (XSS prevention), `linkify: true`, and `breaks: true`. Styling for rendered content (code blocks, lists, blockquotes, etc.) is handled by the `msg-bubble` Tailwind utilities in `globals.css`. While awaiting the first token, `MsgBlock` shows the `Loader` component (a 3D CSS spinner) instead of empty content.

## Learning Reference

- `ROADMAP.md` — 6-stage AI Agent learning plan (current code covers stages 1–2 plus early stage-3 tool-calling).
- `CODE_WIKI.md` — deep dive on modules, functions, and data flows. Note: it predates the settings/DeepSeek/tools refactor in places; prefer reading the code for the current state.
- `docs/RAG.md` — RAG implementation walkthrough.
- `DESIGN.md` — design system (fonts, colors, light/dark themes).
