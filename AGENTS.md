# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An AI agent demo built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4. Uses LangChain + Ollama for local LLM chat with streaming responses, and OGL (WebGL) for animated gradient backgrounds.

## Essential Commands

This project uses **pnpm** as its package manager. Do not use npm or yarn.

```bash
pnpm dev      # Start dev server (http://localhost:3000)
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
| `/` | `app/(main)/page.tsx` | Home — OGL gradient hero |
| `/chat` | `app/(main)/chat/page.tsx` | Streaming AI chat |
| `/rag` | `app/(main)/rag/page.tsx` | Placeholder for RAG features |
| `/docs` | `app/(main)/docs/page.tsx` | Static docs on building RAG with this stack |

### API Routes

Two POST endpoints, both return plain-text streaming responses (not JSON):

- **`/api/baseChat`** — Basic chat with configurable system message. Accepts `{ msg, systemMessage }`. Uses `ChatOllama.stream()` via LangChain.
- **`/api/pipe`** — Chained chat with a hardcoded "senior programmer" system prompt. Accepts `{ msg }`. Uses `ChatPromptTemplate.pipe(model).pipe(StringOutputParser())` chain.

Errors return JSON with shape `{ code, message, data }` via `errorResponse()`.

### Directory Structure

```
app/                  # Next.js App Router (pages + API routes)
components/           # React components, barrel-exported from index.ts
  Chat/               # Streaming chat with AbortController support
  Chat/MsgBlock/      # Single message bubble with markdown-it rendering
  Docs/               # Static documentation page
  Grainient/          # WebGL animated gradient (OGL) — heavy, keep client-only
  Home/               # Hero page wrapping Grainient
  NavTabs.tsx         # Top navigation bar with route-aware active state
  Rag/                # RAG page placeholder
lib/
  api/                # Client-side fetch wrapper (ApiClient class)
  server/             # Server-only: chat logic (baseChat, streamWithPipe), response helpers
constants/
  api.routes.ts       # API route path constants
  app.routes.ts       # Page route constants, NavTab config, active-tab logic
types/
  api.ts              # ApiResponse<T> interface
config.ts             # Ollama model config (host, model names, temperature) — driven by env vars
```

### Key Patterns

- **Barrel exports**: `components/index.ts` and `lib/server/index.ts` re-export public APIs. Import from `@/components` or `@/lib/server`.
- **Path aliases**: `@/*` maps to project root (configured in `tsconfig.json`).
- **CSS utilities**: All component styles are defined as Tailwind v4 `@utility` classes in `app/globals.css`. Do not use inline Tailwind classes directly — use the utility classes (e.g., `chat-panel`, `msg-bubble-ai`, `nav-glass`).
- **Client/Server separation**: Components using hooks, browser APIs, or WebGL are marked `"use client"` at the top. Server-only code lives in `lib/server/` and must not be imported in client components.
- **Streaming responses**: Chat API endpoints return `ReadableStream` with `text/plain` content type. The front-end `Chat` component reads the stream via `response.body.getReader()` and incrementally updates UI. AbortController cancels both the fetch and the reader.
- **ApiClient**: A fetch wrapper in `lib/api/client.ts` for JSON APIs expecting `ApiResponse<T>` shape (`{ code: 0, message, data }`). Not used by the chat page (which uses raw fetch for streaming). Use this for future JSON endpoints.

### Ollama Configuration

All model config lives in `config.ts` and reads from environment variables:

- `OLLAMA_HOST` — Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_CHAT_MODEL` — chat model (default: `qwen3.5:4b`)
- `OLLAMA_EMBED_MODEL` — embedding model for RAG (default: `mxbai-embed-large:latest`)
- `OLLAMA_TEMPERATURE` — model temperature (default: `0.3`)

### Important: Next.js 16 Breaking Changes

This project uses **Next.js 16.2.10**, which has breaking API changes vs. earlier versions. Before writing any Next.js-specific code, consult the guides in `node_modules/next/dist/docs/` — they are the authoritative reference and override any assumptions from training data.

### Markdown Rendering in Chat

Messages are rendered via `markdown-it` with `html: false` (XSS prevention), `linkify: true`, and `breaks: true`. Styling for rendered content (code blocks, lists, blockquotes, etc.) is handled by the `msg-bubble` Tailwind utilities in `globals.css`.
