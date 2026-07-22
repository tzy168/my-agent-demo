# my-agent-demo — Code Wiki

> 基于 Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + LangChain + Ollama 的本地 AI 对话与 RAG 演示应用。

---

## 一、项目概览

### 1.1 基本信息

| 属性 | 说明 |
|------|------|
| 项目名称 | `my-agent-demo` |
| 版本 | `0.1.0` |
| 技术栈 | Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 |
| AI 框架 | LangChain + `@langchain/ollama` |
| 渲染特效 | WebGL (`ogl`) |
| 包管理 | pnpm |
| 产品名 | **TH.AGENT**（短标 **TH**） |

### 1.2 项目定位

本项目是一个**本地 AI 智能体演示应用**，通过 Next.js 全栈架构提供：

- **Home 页**：品牌展示 + WebGL 动态渐变背景（Editorial Minimal 风格）。
- **Chat 页**：基于 Ollama 本地大模型的流式对话，支持停止生成。
- **RAG 页**：完整的检索增强生成（Retrieval-Augmented Generation）流程，包括文档上传、文本切块、向量嵌入、余弦相似度检索、基于检索上下文的流式问答。
- **Docs 页**：面向开发者的 RAG 技术栈说明文档。

后端通过 LangChain 的 Ollama 集成实现与本地模型的交互，支持流式输出与请求中断。

### 1.3 技术栈详情

| 领域 | 选型 | 说明 |
|------|------|------|
| 全栈框架 | Next.js 16.2.10 | App Router + React Server Components |
| UI 库 | React 19.2.4 / React DOM 19.2.4 | 函数组件 + Hooks |
| 类型系统 | TypeScript 5.x | 严格模式 |
| 样式方案 | Tailwind CSS v4 | `@utility` 封装组件级样式 |
| 本地 LLM | Ollama | 通过 `@langchain/ollama` 调用 |
| 聊天模型 | `qwen3.5:4b`（默认） | 由 `OLLAMA_CHAT_MODEL` 控制 |
| 嵌入模型 | `mxbai-embed-large:latest`（默认） | 由 `OLLAMA_EMBED_MODEL` 控制 |
| Markdown 渲染 | `markdown-it` | 前端渲染模型返回的 Markdown |
| WebGL | `ogl` | 动态渐变背景 |

---

## 二、整体架构

### 2.1 分层架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Next.js App Router (v16)                           │
├──────────────────────────────────┬──────────────────────────────────────────┤
│           前端 (Client)           │              后端 (Server)                │
│                                  │                                           │
│  ┌────────────────────────────┐  │  ┌─────────────────────────────────────┐  │
│  │        NavTabs             │  │  │  API Routes                         │  │
│  │  (路由高亮 + 主题切换)        │  │  │  ├── /api/baseChat       基础聊天   │  │
│  └─────────────┬──────────────┘  │  │  ├── /api/pipe           管道聊天   │  │
│                │                 │  │  ├── /api/rag/upload     文档上传   │  │
│  ┌─────────────┴──────────────┐  │  │  ├── /api/rag/search     相似度检索 │  │
│  │      Page Routes           │  │  │  ├── /api/rag/chat       RAG 对话   │  │
│  │  /        → Home           │  │  │  └── /api/rag/status     知识库状态 │  │
│  │  /chat    → Chat           │  │  └─────────────┬──────────────────────┘  │
│  │  /rag     → Rag            │  │                │                         │
│  │  /docs    → Docs           │  │  ┌─────────────┴─────────────┐           │
│  └─────────────┬──────────────┘  │  │       lib/server            │           │
│                │                 │  │  ├─ chat.ts    模型调用层   │           │
│  ┌─────────────┴──────────────┐  │  │  ├─ rag.ts     RAG 核心     │           │
│  │       Components           │  │  │  ├─ response.ts 响应工具    │           │
│  │  ├─ Grainient (WebGL)      │  │  │  └─ index.ts   统一导出     │           │
│  │  ├─ Chat / MsgBlock        │  │  └─────────────┬─────────────┘           │
│  │  ├─ Rag                    │  │                │                         │
│  │  ├─ Home                   │  │  ┌─────────────┴─────────────┐           │
│  │  └─ Docs                   │  │  │        config.ts          │           │
│  └────────────────────────────┘  │  │     Ollama 模型配置         │           │
│                                  │  └─────────────────────────────┘           │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

### 2.2 核心数据流

#### Chat 数据流

```
用户输入
  → components/Chat 发起 fetch → POST /api/pipe
  → app/api/pipe/route.ts
  → lib/server/chat.ts::streamWithPipe()
  → ChatOllama.stream()
  ← ReadableStream (text/plain)
  ← 前端 getReader() 逐 chunk 解码渲染
```

#### RAG 数据流

```
上传文件
  → components/Rag 发起 FormData → POST /api/rag/upload
  → app/api/rag/upload/route.ts
  → lib/server/rag.ts::ingestText()
  → splitText() 切块 → OllamaEmbeddings.embedDocuments() 向量化
  → 存入内存 store[]

检索 / 提问
  → POST /api/rag/search 或 /api/rag/chat
  → lib/server/rag.ts::searchRag() / streamRagChat()
  → embedQuery() 问题向量化 → cosineSimilarity() Top-K 排序
  →（chat 路径）命中片段注入 System Prompt → ChatOllama.stream()
  ← 流式纯文本 + X-Rag-Hits 响应头
```

### 2.3 目录结构

```
my-agent-demo/
├── app/                              # Next.js App Router
│   ├── (main)/                       # 路由分组：共享 MainLayout
│   │   ├── chat/page.tsx             # /chat 页面
│   │   ├── docs/page.tsx             # /docs 页面
│   │   ├── rag/page.tsx              # /rag 页面
│   │   ├── layout.tsx                # 主布局（注入 NavTabs）
│   │   └── page.tsx                  # / 首页
│   ├── api/                          # API 路由
│   │   ├── baseChat/route.ts         # 基础流式聊天
│   │   ├── pipe/route.ts             # 管道流式聊天
│   │   └── rag/
│   │       ├── upload/route.ts       # 文档上传与索引
│   │       ├── search/route.ts       # 向量检索
│   │       ├── chat/route.ts         # RAG 流式对话
│   │       └── status/route.ts       # 知识库状态
│   ├── layout.tsx                    # 根布局（字体 + 主题初始化脚本）
│   └── globals.css                   # 全局样式入口（Tailwind v4）
│
├── components/                       # React 组件
│   ├── Chat/
│   │   ├── MsgBlock/index.tsx        # 单条消息气泡（Markdown 渲染）
│   │   ├── chat.css                  # Chat 样式工具类
│   │   └── index.tsx                 # 聊天面板（流式管理）
│   ├── Docs/
│   │   ├── docs.css                  # Docs 样式工具类
│   │   └── index.tsx                 # 文档页内容
│   ├── Grainient/
│   │   └── index.tsx                 # WebGL 动态渐变背景
│   ├── Home/
│   │   ├── home.css                  # Home 样式工具类
│   │   └── index.tsx                 # 首页品牌展示
│   ├── Rag/
│   │   ├── rag.css                   # RAG 样式工具类
│   │   └── index.tsx                 # RAG 上传 / 检索 / 对话 UI
│   ├── NavTabs.tsx                   # 顶部导航 + 主题切换
│   ├── nav.css                       # 导航样式工具类
│   ├── ui/.gitkeep                   # 预留 UI 组件目录
│   └── index.ts                      # 组件 barrel export（导出 NavTabs、Docs）
│
├── constants/                        # 常量定义
│   ├── api.routes.ts                 # API 路径常量
│   └── app.routes.ts                 # 页面路由与导航配置
│
├── lib/                              # 工具库
│   ├── api/
│   │   ├── client.ts                 # 浏览器端 fetch 封装
│   │   └── index.ts                  # 统一导出
│   └── server/
│       ├── chat.ts                   # LangChain 聊天逻辑
│       ├── rag.ts                    # RAG 核心逻辑
│       ├── response.ts               # 统一响应构造器
│       └── index.ts                  # 统一导出
│
├── styles/                           # 跨模块样式
│   ├── tokens.css                    # 设计 token（颜色 / 字体）
│   ├── shared.css                    # 共享工具类
│   └── layout.css                    # 布局工具类
│
├── types/                            # TypeScript 类型定义
│   ├── api.ts                        # API 通用类型
│   └── index.ts                      # 统一导出
│
├── docs/                             # 业务文档
│   └── RAG.md                        # RAG 从 0 到 1 说明
│
├── public/                           # 静态资源
├── config.ts                         # Ollama 模型全局配置
├── next.config.ts                    # Next.js 配置
├── package.json                      # 项目依赖与脚本
├── tsconfig.json                     # TypeScript 配置
├── eslint.config.mjs                 # ESLint 配置
├── postcss.config.mjs                # PostCSS 配置
├── AGENTS.md                         # AI Agent 工作规范
├── CLAUDE.md                         # Claude Code 工作规范
├── DESIGN.md                         # 设计系统文档
├── CODE_WIKI.md                      # 本文档
└── README.md                         # 项目入口说明
```

---

## 三、模块职责

### 3.1 前端模块 (`app/` + `components/`)

| 模块 | 职责 | 技术要点 |
|------|------|----------|
| `app/layout.tsx` | 根布局 | 加载 Google Fonts（Fraunces / Outfit / JetBrains Mono）、注入主题初始化脚本、设置 `data-theme` |
| `app/(main)/layout.tsx` | 主布局壳 | 用 `NavTabs` 包裹所有业务页面 |
| `app/(main)/page.tsx` | 首页路由 | 渲染 `Home` 组件 |
| `app/(main)/chat/page.tsx` | 聊天页路由 | 渲染 `Chat` 组件，占满顶栏下方空间 |
| `app/(main)/rag/page.tsx` | RAG 页路由 | 渲染 `Rag` 组件，双栏布局 |
| `app/(main)/docs/page.tsx` | 文档页路由 | 渲染 `Docs` 组件 |
| `components/NavTabs.tsx` | 顶部毛玻璃导航栏 | `usePathname` 高亮当前 Tab、localStorage 主题持久化 |
| `components/Home/index.tsx` | 品牌展示区 | 集成 `Grainient` WebGL 背景、品牌大字 |
| `components/Chat/index.tsx` | 聊天交互面板 | 流式读取、AbortController 中断、自动滚动、停止生成 |
| `components/Chat/MsgBlock/index.tsx` | 单条消息气泡 | `markdown-it` 渲染，XSS 防护（`html: false`） |
| `components/Rag/index.tsx` | RAG 交互面板 | 文件上传、相似度检索、RAG Chat、检索命中展示 |
| `components/Docs/index.tsx` | 静态文档页 | 面向开发者的 RAG 实现指南 |
| `components/Grainient/index.tsx` | WebGL 动态渐变背景 | `ogl` 库，GLSL shader，IntersectionObserver / visibilitychange 性能优化 |
| `lib/api/client.ts` | 浏览器端请求封装 | 统一 `ApiResponse` 结构处理（RAG/status 等 JSON 接口使用） |

### 3.2 后端模块 (`app/api/` + `lib/server/`)

| 模块 | 职责 | 技术要点 |
|------|------|----------|
| `app/api/baseChat/route.ts` | 基础聊天 API | 接收 `msg` + `systemMessage`，返回纯文本流 |
| `app/api/pipe/route.ts` | 管道流式聊天 API | 接收 `msg`，通过 `streamWithPipe` 返回流 |
| `app/api/rag/upload/route.ts` | 文档上传 API | 校验 `.txt` / `.md` / `.markdown`、≤ 1MB、可选清空知识库 |
| `app/api/rag/search/route.ts` | 向量检索 API | 接收 `query` + `k`，返回带余弦相似度的命中 |
| `app/api/rag/chat/route.ts` | RAG 对话 API | 检索 + 生成，返回纯文本流 + `X-Rag-Hits` 响应头 |
| `app/api/rag/status/route.ts` | 知识库状态 API | 返回 chunk 数量与来源文件列表 |
| `lib/server/chat.ts` | LangChain 聊天调用层 | `ChatOllama` 初始化、`baseChat`、`streamWithPipe` |
| `lib/server/rag.ts` | RAG 核心逻辑 | 文本切块、嵌入、余弦相似度检索、RAG 流式生成 |
| `lib/server/response.ts` | 统一响应工具 | `successResponse`、`errorResponse` |
| `lib/server/index.ts` | 服务端模块统一导出 | barrel export，供 API 路由批量导入 |

### 3.3 样式与主题 (`app/globals.css` + `styles/`)

| 文件 | 职责 |
|------|------|
| `app/globals.css` | 全局样式入口：`@import "tailwindcss"`、导入各模块 CSS、设置 `body` / `::selection` / 减少动效媒体查询 |
| `styles/tokens.css` | 设计 token：浅色 / 深色主题 CSS 变量、字体、缓动函数 |
| `styles/layout.css` | 布局工具类：`app-shell`、`page-stack`、`page-content`、`page-fill`、`page-center`、`page-bleed` |
| `styles/shared.css` | 跨模块共享工具：`scrollbar-none`、`sr-only` |
| `components/nav.css` | 导航栏工具类：`nav-glass`、`nav-tab`、`nav-theme` 等 |
| `components/Home/home.css` | 首页工具类：`brand-hero`、`brand-hero-accent` |
| `components/Chat/chat.css` | 聊天工具类：`chat-panel`、`msg-bubble-*`、`chat-input` 等 |
| `components/Rag/rag.css` | RAG 工具类：`rag-grid`、`rag-side`、`rag-hit`、`rag-cite` 等 |
| `components/Docs/docs.css` | 文档页工具类：`docs-scroll`、`docs-title`、`docs-pre` 等 |

---

## 四、关键类与函数说明

### 4.1 服务端核心

#### `lib/server/chat.ts`

##### `model: ChatOllama`

全局单例聊天模型实例。

```typescript
const model = new ChatOllama({
  model: modelConfig.ollama.chatModel,      // 默认 "qwen3.5:4b"
  baseUrl: modelConfig.ollama.host,          // 默认 "http://localhost:11434"
  temperature: Number(modelConfig.ollama.temperature), // 默认 0.3
  think: false,
});
```

##### `toTextContent(content: unknown): string`

将 LangChain 返回的 `content`（可能为 `string` 或 `ContentBlock[]`）统一抽取为纯文本字符串。

| 参数 | 类型 | 说明 |
|------|------|------|
| `content` | `unknown` | LangChain 返回的消息内容 |
| 返回值 | `string` | 提取后的纯文本 |

##### `baseChat(msg, systemMessage, signal?)`

基础流式聊天函数，直接调用 `ChatOllama.stream()` 并包装为 `ReadableStream`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg` | `string` | 是 | 用户输入 |
| `systemMessage` | `string` | 是 | 系统提示词 |
| `signal` | `AbortSignal` | 否 | 用于中断请求的信号 |

**返回**: `Promise<ReadableStream>` — `text/plain` 纯文本流

**流程**:
1. 构造 `SystemMessage` + `HumanMessage`。
2. 调用 `model.stream()` 获取异步生成器。
3. 包装为 `ReadableStream`，逐 chunk 编码为 `Uint8Array`。
4. 监听 `AbortSignal` 实现优雅中断。

##### `streamWithPipe(msg)`

使用 **LangChain Expression Language (LCEL)** 管道构建的流式聊天函数。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg` | `string` | 是 | 用户问题 |

**管道定义**:
```
ChatPromptTemplate.fromMessages([SystemMessage, HumanMessage])
  → ChatOllama(model)
  → StringOutputParser()
```

系统预设角色：*“你是一个资深的程序员技术大佬，擅长将零碎、复杂的知识，体系化、简单化，并给出快速入门的建议。”*

**返回**: `Promise<ReadableStream>` — `text/plain` 纯文本流

#### `lib/server/rag.ts`

##### 类型 `StoredChunk`

```typescript
type StoredChunk = {
  content: string;     // 文本块原文
  embedding: number[]; // 嵌入向量
  source: string;      // 来源文件名
};
```

##### `store: StoredChunk[]`

进程内存中的向量知识库。**进程重启或热重载会清空**。

##### `embeddings: OllamaEmbeddings`

嵌入模型实例，默认模型 `mxbai-embed-large:latest`。

##### `chatModel: ChatOllama`

RAG 对话专用模型实例，配置与 `chat.ts` 中的 `model` 一致。

##### `cosineSimilarity(a, b): number`

计算两个向量的余弦相似度，范围 `[-1, 1]`，本场景通常接近 `[0, 1]`，越大越相关。

##### `splitText(text, chunkSize?, overlap?): string[]`

按字符切块，默认 `chunkSize = 400`、`overlap = 60`。相邻块重叠以保留上下文衔接。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | `string` | - | 原始文本 |
| `chunkSize` | `number` | `400` | 每块最大字符数 |
| `overlap` | `number` | `60` | 相邻块重叠字符数 |

##### `getRagStatus(): { chunkCount, sources }`

返回当前知识库状态：chunk 总数与去重后的来源文件列表。

##### `clearRagStore(): { chunkCount, sources }`

清空内存知识库，返回最新状态。

##### `ingestText(text, source)`

写入知识库：切分 → 嵌入 → 存入内存。

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 文件原文 |
| `source` | `string` | 文件名，用于溯源 |

**返回**: `{ source, addedChunks, chunkCount, sources }`

##### `searchRag(query, k?): RagHit[]`

向量检索 Top-K。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | `string` | - | 查询文本 |
| `k` | `number` | `4` | 返回命中数量 |

**返回**: `RagHit[]`，按 `score` 降序排列。

```typescript
export type RagHit = {
  content: string;
  source: string;
  score: number; // 余弦相似度
};
```

##### `streamRagChat(msg, signal?)`

RAG 对话：先检索再生成。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg` | `string` | 是 | 用户问题 |
| `signal` | `AbortSignal` | 否 | 中断信号 |

**流程**:
1. `searchRag(msg, 4)` 获取命中片段。
2. 将命中片段按格式拼入 System Prompt：
   ```text
   你是知识库问答助手。请严格依据「检索上下文」回答用户问题；若上下文不足以回答，请明确说不知道，不要编造。

   检索上下文：
   [片段1 | 相似度 82.3% | 来源 notes.md]
   ...
   ```
3. 调用 `chatModel.stream()` 流式生成。
4. 返回 `{ stream, hits }`，供 API 路由写入响应头。

#### `lib/server/response.ts`

##### `successResponse<T>(data, message?)`

构造标准成功响应（HTTP 200）。

```typescript
{ code: 0, message: "success", data: T }
```

##### `errorResponse(message, code?, status?)`

构造标准错误响应（默认 HTTP 500）。

```typescript
{ code: -1, message: "错误信息", data: null }
```

### 4.2 API 路由层

| 路由 | 方法 | 请求体 / 参数 | 响应格式 | 说明 |
|------|------|---------------|----------|------|
| `/api/baseChat` | `POST` | `{ msg, systemMessage }` | `text/plain` 流 | 基础流式对话，可自定义 system prompt |
| `/api/pipe` | `POST` | `{ msg }` | `text/plain` 流 | 管道流式对话（默认“资深程序员”角色） |
| `/api/rag/upload` | `POST` | `multipart/form-data`：`file`，可选 `clear=1` | `ApiResponse` | 上传并索引文档 |
| `/api/rag/search` | `POST` | `{ query, k? }` | `ApiResponse<{ hits, query }>` | 余弦相似度检索 |
| `/api/rag/chat` | `POST` | `{ msg }` | `text/plain` 流 + `X-Rag-Hits` 头 | 检索 + 流式生成 |
| `/api/rag/status` | `GET` | - | `ApiResponse<{ chunkCount, sources }>` | 知识库状态 |

**错误处理**：异常时返回 JSON `{ code, message, data }`，HTTP 状态码由 `errorResponse` 指定。

### 4.3 前端组件

#### `Chat` (`components/Chat/index.tsx`)

核心聊天交互组件，**Client Component**（`"use client"`）。

**状态管理**:

| 状态 | 类型 | 说明 |
|------|------|------|
| `messages` | `ChatMessage[]` | 消息列表（含 id, role, content） |
| `input` | `string` | 输入框内容 |
| `loading` | `boolean` | 是否正在生成回复 |

**关键引用**:

| 引用 | 类型 | 说明 |
|------|------|------|
| `listRef` | `HTMLDivElement` | 消息列表容器，用于自动滚动 |
| `abortControllerRef` | `AbortController \| null` | 控制 fetch 请求中断 |
| `readerRef` | `ReadableStreamReader \| null` | 控制流读取中断 |

**核心方法**:

- **`handleSubmit()`**
  1. 校验输入非空。
  2. 追加用户消息 + 空的 AI 占位消息。
  3. 发起 `fetch(API_ROUTES.PIPE, ...)`，携带 `AbortSignal`。
  4. 使用 `TextDecoder` 逐块解码流数据。
  5. 实时更新对应 AI 消息的 `content`。
  6. 处理完成 / 错误 / 中断三种终止状态。

- **`handleAbort()`**
  - 若流已开始（`readerRef` 存在）：`reader.cancel()`。
  - 若仍在等待响应：`abortController.abort()`。

#### `MsgBlock` (`components/Chat/MsgBlock/index.tsx`)

单条消息渲染组件。

| 属性 | 类型 | 说明 |
|------|------|------|
| `role` | `"human" \| "ai"` | 消息角色 |
| `content` | `string` | 消息内容（Markdown） |

**安全策略**：使用 `markdown-it` 渲染时设置 `html: false`，禁止原生 HTML 标签，降低 XSS 注入风险。

#### `Rag` (`components/Rag/index.tsx`)

RAG 交互面板，**Client Component**。分为左右两栏：

- **左栏**：知识库上传、检索试玩、命中结果列表。
- **右栏**：RAG Chat，支持流式输出与命中片段展开查看。

**状态管理**:

| 状态 | 类型 | 说明 |
|------|------|------|
| `status` | `RagStatus` | 知识库 chunk 数与来源 |
| `clearBeforeUpload` | `boolean` | 上传前是否清空知识库 |
| `query` / `hits` / `searchError` | - | 检索相关状态 |
| `messages` / `input` / `loading` | - | RAG Chat 相关状态 |

**核心方法**:

- **`handleUpload(e)`**：`FormData` 上传文件，更新知识库状态。
- **`handleSearch(e)`**：调用 `/api/rag/search`，展示相似度进度条。
- **`handleChat()`**：调用 `/api/rag/chat`，解析 `X-Rag-Hits` 响应头，流式更新 AI 消息。
- **`handleAbort()`**：中断生成。

#### `NavTabs` (`components/NavTabs.tsx`)

顶部导航栏组件，**Client Component**。

- 使用 `usePathname()` 判断当前路由。
- 毛玻璃效果：`backdrop-blur` + 半透明背景。
- 主题切换：圆形按钮，写入 `localStorage`，首屏脚本避免闪烁。
- Tab：`HOME` / `CHAT` / `RAG` / `DOCS`。

#### `Grainient` (`components/Grainient/index.tsx`)

WebGL 动态渐变背景组件，**Client Component**。

**技术实现**:
- 底层库: [`ogl`](https://github.com/oframe/ogl)。
- 几何体: 全屏 `Triangle`。
- Shader: 自定义 GLSL fragment shader（noise、warp、grain、blend 等效果）。
- 动画: `requestAnimationFrame` 驱动 uniform `iTime`。

**性能优化**:
- `ResizeObserver` 自适应容器尺寸。
- `IntersectionObserver` 在不可见时暂停渲染。
- `document.visibilitychange` 在后台标签页暂停渲染。
- `WeakMap` 缓存 WebGL 上下文，避免重建。

**可调参数**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `timeSpeed` | `number` | `0.25` | 时间流速 |
| `color1` / `color2` / `color3` | `string` | `#FF9FFC` / `#5227FF` / `#B497CF` | 主色 |
| `warpStrength` | `number` | `1` | 扭曲强度 |
| `warpFrequency` | `number` | `5` | 扭曲频率 |
| `warpSpeed` | `number` | `2` | 扭曲速度 |
| `warpAmplitude` | `number` | `50` | 扭曲振幅 |
| `blendAngle` | `number` | `0` | 混合角度 |
| `blendSoftness` | `number` | `0.05` | 混合柔和度 |
| `rotationAmount` | `number` | `500` | 旋转量 |
| `noiseScale` | `number` | `2` | 噪点缩放 |
| `grainAmount` | `number` | `0.1` | 颗粒强度 |
| `grainScale` | `number` | `2` | 颗粒缩放 |
| `grainAnimated` | `boolean` | `false` | 颗粒是否动画 |
| `contrast` | `number` | `1.5` | 对比度 |
| `gamma` | `number` | `1` | 伽马值 |
| `saturation` | `number` | `1` | 饱和度 |
| `centerX` / `centerY` | `number` | `0` | 中心偏移 |
| `zoom` | `number` | `0.9` | 缩放 |

### 4.4 配置与常量

#### `config.ts`

```typescript
export const modelConfig = {
  ollama: {
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    chatModel: process.env.OLLAMA_CHAT_MODEL || 'qwen3.5:4b',
    embedModel: process.env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large:latest',
    temperature: process.env.OLLAMA_TEMPERATURE || 0.3,
  }
}
```

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama 服务地址 |
| `OLLAMA_CHAT_MODEL` | `qwen3.5:4b` | 聊天模型名称 |
| `OLLAMA_EMBED_MODEL` | `mxbai-embed-large:latest` | 嵌入模型名称 |
| `OLLAMA_TEMPERATURE` | `0.3` | 生成随机性，越低越确定性 |

#### `constants/app.routes.ts`

| 常量 | 值 | 说明 |
|------|-----|------|
| `APP_ROUTES.HOME` | `"/"` | 首页路径 |
| `APP_ROUTES.CHAT` | `"/chat"` | 聊天页路径 |
| `APP_ROUTES.RAG` | `"/rag"` | RAG 页路径 |
| `APP_ROUTES.DOCS` | `"/docs"` | 文档页路径 |
| `NAV_TABS` | `NavTab[]` | 导航栏配置数组 |

`isNavTabActive(pathname, href)`：判断当前 Tab 是否激活。首页要求精确匹配，其他页面支持前缀匹配。

#### `constants/api.routes.ts`

| 常量 | 值 | 说明 |
|------|-----|------|
| `API_ROUTES.BASE_CHAT` | `"/api/baseChat"` | 基础聊天 API |
| `API_ROUTES.PIPE` | `"/api/pipe"` | 管道流式 API |
| `API_ROUTES.RAG_UPLOAD` | `"/api/rag/upload"` | RAG 上传 API |
| `API_ROUTES.RAG_SEARCH` | `"/api/rag/search"` | RAG 检索 API |
| `API_ROUTES.RAG_CHAT` | `"/api/rag/chat"` | RAG 对话 API |
| `API_ROUTES.RAG_STATUS` | `"/api/rag/status"` | RAG 状态 API |

### 4.5 类型定义

#### `types/api.ts`

```typescript
export interface ApiResponse<T = unknown> {
  code: number;      // 0 表示成功，非 0 表示业务错误
  message: string;   // 提示信息
  data: T;           // 业务数据
}

export interface HelloData {
  message: string;
}
```

#### 组件局部类型

```typescript
// components/Chat/MsgBlock/index.tsx
type MsgRole = "human" | "ai";
interface MsgBlockProps { role: MsgRole; content: string; }

// components/Rag/index.tsx
type RagHit = { content: string; source: string; score: number; };
type RagStatus = { chunkCount: number; sources: string[]; };
```

---

## 五、依赖关系

### 5.1 核心依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `next` | `16.2.10` | React 全栈框架（App Router） |
| `react` / `react-dom` | `19.2.4` | UI 库 |
| `typescript` | `^5` | 类型系统 |
| `tailwindcss` | `^4` | 原子化 CSS |
| `@tailwindcss/postcss` | `^4` | Tailwind v4 PostCSS 插件 |

### 5.2 AI / LangChain 依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `langchain` | `^1.5.3` | LangChain 核心框架 |
| `@langchain/core` | `^1.2.2` | 核心抽象（Messages, Prompts, Parsers） |
| `@langchain/ollama` | `^1.3.0` | Ollama 本地模型集成 |

### 5.3 工具库

| 包名 | 版本 | 用途 |
|------|------|------|
| `markdown-it` | `^14.3.0` | Markdown 渲染（MsgBlock） |
| `ogl` | `^1.0.11` | 轻量级 WebGL 渲染器（Grainient） |

### 5.4 类型定义

| 包名 | 版本 | 用途 |
|------|------|------|
| `@types/markdown-it` | `^14.1.2` | markdown-it 类型 |
| `@types/node` | `^20` | Node.js 内置 API 类型 |
| `@types/react` / `@types/react-dom` | `^19` | React 类型 |

### 5.5 模块依赖图

```
app/api/baseChat/route.ts ──┐
app/api/pipe/route.ts ──────┼──► lib/server/chat.ts
                            │      ├── @langchain/ollama
                            │      ├── @langchain/core
                            │      └── config.ts
app/api/rag/*/route.ts ─────┤
                            │
                            ├──► lib/server/rag.ts
                            │      ├── @langchain/ollama
                            │      ├── @langchain/core
                            │      └── config.ts
                            │
                            └──► lib/server/response.ts
                                     └── types/api.ts

components/Chat/index.tsx ──► constants/api.routes.ts
components/Chat/index.tsx ──► components/Chat/MsgBlock
components/Rag/index.tsx ───► constants/api.routes.ts
components/Rag/index.tsx ───► components/Chat/MsgBlock
components/NavTabs.tsx ─────► constants/app.routes.ts
components/Grainient/index.tsx ──► ogl
lib/api/client.ts ──────────► types/api.ts
```

---

## 六、项目运行方式

### 6.1 前置依赖

1. **Node.js** >= 18
2. **pnpm**
3. **Ollama** 本地服务已启动，且已拉取对应模型：

   ```bash
   # 启动 Ollama 服务
   ollama serve

   # 拉取聊天模型（默认 qwen3.5:4b）
   ollama pull qwen3.5:4b

   # 拉取嵌入模型（RAG 使用，默认 mxbai-embed-large）
   ollama pull mxbai-embed-large:latest
   ```

### 6.2 安装与启动

```bash
# 安装依赖
pnpm install

# 开发模式启动（默认端口 3000）
pnpm dev

# 构建生产版本
pnpm build

# 生产模式启动
pnpm start

# ESLint 代码检查
pnpm lint
```

### 6.3 环境变量配置

在项目根目录创建 `.env.local`（可选，未设置时采用 `config.ts` 中的默认值）：

```bash
# Ollama 服务地址
OLLAMA_HOST=http://localhost:11434

# 聊天模型
OLLAMA_CHAT_MODEL=qwen3.5:4b

# 嵌入模型（RAG 使用）
OLLAMA_EMBED_MODEL=mxbai-embed-large:latest

# 模型温度（0 ~ 1，越低越稳定）
OLLAMA_TEMPERATURE=0.3
```

### 6.4 访问地址

| 环境 | URL |
|------|-----|
| 开发环境 | http://localhost:3000 |
| 首页 | http://localhost:3000/ |
| 聊天页 | http://localhost:3000/chat |
| RAG 页 | http://localhost:3000/rag |
| 文档页 | http://localhost:3000/docs |

---

## 七、扩展建议

### 7.1 RAG 模块升级

当前 RAG 已实现完整的最小可用链路，可进一步升级：

| 现状 | 升级方向 |
|------|----------|
| 内存库，热重载清空 | Chroma / pgvector / LanceDB 持久化 |
| 仅 txt/md | PDFLoader / DocxLoader 等解析更多格式 |
| 线性扫描全部向量 | ANN 索引（HNSW、FAISS） |
| 单轮问答 | 带历史的多轮对话 + 会话级过滤 |
| 无重排序 | cross-encoder rerank |
| 固定 chunk | RecursiveCharacterTextSplitter 按语义递归切分 |

### 7.2 会话持久化

- 当前 `Chat` / `Rag` 的消息存储在 React State 中，页面刷新即丢失。
- 可接入 `localStorage` / `IndexedDB` / 后端数据库实现会话历史保存。

### 7.3 多模型切换

- 在 `config.ts` 中扩展多模型配置数组。
- 前端增加模型选择器，通过 API 参数动态切换 `ChatOllama` 实例。

### 7.4 主题与设计系统

- 设计系统详见 `DESIGN.md`。
- 新增 UI 优先复用 `styles/` 与组件 CSS 中已有的 `@utility` 类名。

---

## 八、附录

### 8.1 文件清单

| 路径 | 说明 |
|------|------|
| `app/(main)/layout.tsx` | 主布局 |
| `app/(main)/page.tsx` | 首页 |
| `app/(main)/chat/page.tsx` | Chat 页面 |
| `app/(main)/rag/page.tsx` | RAG 页面 |
| `app/(main)/docs/page.tsx` | Docs 页面 |
| `app/layout.tsx` | 根布局与主题脚本 |
| `app/globals.css` | 全局样式入口 |
| `app/api/baseChat/route.ts` | 基础聊天 API |
| `app/api/pipe/route.ts` | 管道聊天 API |
| `app/api/rag/upload/route.ts` | RAG 上传 API |
| `app/api/rag/search/route.ts` | RAG 检索 API |
| `app/api/rag/chat/route.ts` | RAG 对话 API |
| `app/api/rag/status/route.ts` | RAG 状态 API |
| `components/NavTabs.tsx` | 顶部导航 |
| `components/Home/index.tsx` | 首页 |
| `components/Chat/index.tsx` | 聊天面板 |
| `components/Chat/MsgBlock/index.tsx` | 消息气泡 |
| `components/Rag/index.tsx` | RAG 面板 |
| `components/Docs/index.tsx` | 文档页 |
| `components/Grainient/index.tsx` | WebGL 背景 |
| `components/index.ts` | 组件 barrel export（导出 NavTabs、Docs） |
| `lib/server/chat.ts` | 聊天逻辑 |
| `lib/server/rag.ts` | RAG 逻辑 |
| `lib/server/response.ts` | 响应工具 |
| `lib/server/index.ts` | 服务端 barrel export |
| `lib/api/client.ts` | 浏览器端 API 封装 |
| `lib/api/index.ts` | API 封装 barrel export |
| `constants/api.routes.ts` | API 路径常量 |
| `constants/app.routes.ts` | 页面路由常量 |
| `types/api.ts` | API 通用类型 |
| `types/index.ts` | 类型 barrel export |
| `styles/tokens.css` | 设计 token |
| `styles/shared.css` | 共享工具类 |
| `styles/layout.css` | 布局工具类 |
| `components/nav.css` | 导航样式 |
| `components/Home/home.css` | 首页样式 |
| `components/Chat/chat.css` | 聊天样式 |
| `components/Rag/rag.css` | RAG 样式 |
| `components/Docs/docs.css` | 文档样式 |
| `config.ts` | Ollama 配置 |
| `next.config.ts` | Next.js 配置 |
| `tsconfig.json` | TypeScript 配置 |
| `package.json` | 依赖与脚本 |

### 8.2 TypeScript 路径别名

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

项目内所有模块均通过 `@/` 前缀导入，如 `@/components/Chat`、`@/lib/server`。

### 8.3 代码规范

- **框架**: Next.js App Router（React Server Components 优先）。
- **样式**: Tailwind CSS v4，组件级样式使用 `@utility` 封装。
- **字体**: Fraunces / Outfit / JetBrains Mono（通过 `next/font/google` 加载）。
- **Client Component 标识**: 需要浏览器 API 或交互的组件顶部标注 `"use client"`。
- **流式响应格式**: 纯文本流（`text/plain; charset=utf-8`），非 SSE / EventStream。
- **包管理**: 使用 pnpm，避免 npm / yarn。
- **路径别名**: 统一使用 `@/` 导入。

### 8.4 相关文档

| 文档 | 说明 |
|------|------|
| `README.md` | 项目入口与启动说明 |
| `AGENTS.md` | AI Agent 协作规范 |
| `CLAUDE.md` | Claude Code 工作规范 |
| `DESIGN.md` | 设计系统（Editorial Minimal） |
| `docs/RAG.md` | RAG 从 0 到 1 步骤说明 |

---

*文档更新时间：2026-07-22*  
*对应代码版本：v0.1.0*
