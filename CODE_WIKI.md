# my-agent-demo — Code Wiki

> 基于 Next.js + React + TypeScript + LangChain + Ollama 的 AI 对话与 RAG 演示应用。

---

## 一、项目概览

### 1.1 基本信息

| 属性 | 说明 |
|------|------|
| 项目名称 | `my-agent-demo` |
| 版本 | `0.1.0` |
| 技术栈 | Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 |
| AI 框架 | LangChain + @langchain/ollama |
| 渲染特效 | WebGL (ogl) |
| 包管理 | pnpm (支持 npm/yarn/bun) |

### 1.2 项目定位

本项目是一个**本地 AI 智能体演示应用**，通过 Next.js 全栈架构提供：
- **Home 页**：品牌展示 + WebGL 动态渐变背景
- **Chat 页**：基于 Ollama 本地大模型的流式对话
- **RAG 页**：预留的检索增强生成（Retrieval-Augmented Generation）扩展入口

后端通过 LangChain 的 Ollama 集成实现与本地模型的交互，支持流式输出与请求中断。

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App (v16)                        │
│                    (App Router + React Server Components)       │
├──────────────────────────────┬──────────────────────────────────┤
│         前端 (Client)         │           后端 (Server)          │
│                              │                                  │
│  ┌────────────────────────┐  │  ┌────────────────────────────┐  │
│  │     NavTabs 导航栏     │  │  │   /api/baseChat  基础聊天   │  │
│  │  (Link + usePathname)  │  │  │   /api/pipe      管道流式   │  │
│  └───────────┬────────────┘  │  └─────────────┬──────────────┘  │
│              │               │                │                  │
│  ┌───────────┴────────────┐  │     ┌──────────▼──────────┐      │
│  │      Page Routes       │  │     │    lib/server       │      │
│  │  /        → Home       │  │     │  ├─ chat.ts         │      │
│  │  /chat    → Chat       │  │     │  ├─ response.ts     │      │
│  │  /rag     → Rag        │  │     │  └─ index.ts        │      │
│  └───────────┬────────────┘  │     └──────────┬──────────┘      │
│              │               │                │                  │
│  ┌───────────┴────────────┐  │     ┌──────────▼──────────┐      │
│  │     Components         │  │     │   config.ts         │      │
│  │  ├─ Grainient (WebGL)  │  │     │   Ollama 模型配置    │      │
│  │  ├─ Chat (流式对话)     │  │     └─────────────────────┘      │
│  │  ├─ MsgBlock (Markdown)│  │                                  │
│  │  └─ Rag (占位)          │  │                                  │
│  └────────────────────────┘  │                                  │
│                              │                                  │
└──────────────────────────────┴──────────────────────────────────┘
```

### 2.1 目录结构

```
my-agent-demo/
├── app/                          # Next.js App Router
│   ├── (main)/                   # 路由分组：主布局
│   │   ├── chat/page.tsx         # 聊天页
│   │   ├── rag/page.tsx          # RAG 页
│   │   ├── layout.tsx            # 主布局（含 NavTabs）
│   │   └── page.tsx              # 首页
│   ├── api/                      # API 路由
│   │   ├── baseChat/route.ts     # 基础聊天 API
│   │   └── pipe/route.ts         # 管道流式聊天 API
│   ├── layout.tsx                # 根布局（字体 + 全局样式）
│   └── globals.css               # 全局 CSS（Tailwind v4）
│
├── components/                   # React 组件
│   ├── Chat/
│   │   ├── MsgBlock/index.tsx    # 消息气泡（Markdown 渲染）
│   │   └── index.tsx             # 聊天面板（流式请求管理）
│   ├── Grainient/index.tsx       # WebGL 动态渐变背景
│   ├── Home/index.tsx            # 首页品牌展示
│   ├── Rag/index.tsx             # RAG 占位页
│   ├── NavTabs.tsx               # 顶部导航标签
│   └── index.ts                  # 组件统一导出
│
├── constants/                    # 常量定义
│   ├── api.routes.ts             # API 路由常量
│   └── app.routes.ts             # 页面路由与导航配置
│
├── lib/                          # 工具库
│   ├── api/
│   │   └── client.ts             # 浏览器端 API 请求封装
│   └── server/
│       ├── chat.ts               # LangChain 聊天逻辑（Ollama）
│       ├── response.ts           # 统一响应构造器
│       └── index.ts              # 服务端模块统一导出
│
├── types/                        # TypeScript 类型定义
│   ├── api.ts                    # API 通用类型
│   └── index.ts                  # 类型统一导出
│
├── public/                       # 静态资源
├── config.ts                     # Ollama 模型全局配置
├── next.config.ts                # Next.js 配置
├── package.json                  # 项目依赖与脚本
└── tsconfig.json                 # TypeScript 配置
```

---

## 三、模块职责

### 3.1 前端模块 (`app/` + `components/`)

| 模块 | 职责 | 技术要点 |
|------|------|----------|
| `app/(main)/layout.tsx` | 主布局壳，包裹所有业务页面 | 注入 `NavTabs` 导航 |
| `app/(main)/page.tsx` | 首页路由 | 渲染 `Home` 组件 |
| `app/(main)/chat/page.tsx` | 聊天页路由 | 渲染 `Chat` 组件 |
| `app/(main)/rag/page.tsx` | RAG 页路由 | 渲染 `Rag` 占位组件 |
| `components/NavTabs.tsx` | 顶部毛玻璃导航栏 | `usePathname` 高亮当前 Tab |
| `components/Home/index.tsx` | 品牌展示区 | 集成 `Grainient` WebGL 背景 |
| `components/Chat/index.tsx` | 聊天交互面板 | 流式读取、AbortController 中断、自动滚动 |
| `components/Chat/MsgBlock/index.tsx` | 单条消息气泡 | `markdown-it` 渲染，XSS 防护（`html: false`） |
| `components/Grainient/index.tsx` | WebGL 动态渐变背景 | `ogl` 库，GLSL shader，IntersectionObserver 性能优化 |
| `lib/api/client.ts` | 浏览器端请求封装 | 统一 `ApiResponse` 结构处理 |

### 3.2 后端模块 (`app/api/` + `lib/server/`)

| 模块 | 职责 | 技术要点 |
|------|------|----------|
| `app/api/baseChat/route.ts` | 基础聊天 API | 接收 `msg` + `systemMessage`，返回纯文本流 |
| `app/api/pipe/route.ts` | 管道流式聊天 API | 接收 `msg`，通过 `streamWithPipe` 返回流 |
| `lib/server/chat.ts` | LangChain 模型调用层 | `ChatOllama` 初始化、`baseChat`、`streamWithPipe` |
| `lib/server/response.ts` | 统一响应工具 | `successResponse`、`errorResponse` |

---

## 四、关键类与函数说明

### 4.1 服务端核心 (`lib/server/chat.ts`)

#### `model: ChatOllama`

全局单例模型实例，基于 `@langchain/ollama` 创建。

```typescript
const model = new ChatOllama({
  model: modelConfig.ollama.chatModel,      // e.g. "qwen3.5:4b"
  baseUrl: modelConfig.ollama.host,          // e.g. "http://localhost:11434"
  temperature: Number(modelConfig.ollama.temperature), // e.g. 0.3
  think: false,
});
```

#### `toTextContent(content: unknown): string`

将 LangChain 的 `content`（可能为 `string` 或 `ContentBlock[]`）统一抽取为纯文本字符串。

| 参数 | 类型 | 说明 |
|------|------|------|
| `content` | `unknown` | LangChain 返回的消息内容 |
| 返回值 | `string` | 提取后的纯文本 |

#### `baseChat(msg, systemMessage, signal?)`

基础流式聊天函数，直接调用模型并返回 `ReadableStream`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg` | `string` | 是 | 用户输入 |
| `systemMessage` | `string` | 是 | 系统提示词 |
| `signal` | `AbortSignal` | 否 | 用于中断请求的信号 |

**返回**: `Promise<ReadableStream>` — `text/plain` 纯文本流

**流程**:
1. 构造 `SystemMessage` + `HumanMessage`
2. 调用 `model.stream()` 获取异步生成器
3. 包装为 `ReadableStream`，逐 chunk 编码为 `Uint8Array`
4. 监听 `AbortSignal` 实现优雅中断

#### `streamWithPipe(msg)`

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

系统预设角色：*“资深程序员技术大佬，擅长将零碎、复杂的知识体系化、简单化，并给出快速入门的建议。”*

**返回**: `Promise<ReadableStream>` — `text/plain` 纯文本流

### 4.2 响应工具 (`lib/server/response.ts`)

#### `successResponse<T>(data, message?)`

构造标准成功响应（HTTP 200）。

```typescript
{ code: 0, message: "success", data: T }
```

#### `errorResponse(message, code?, status?)`

构造标准错误响应（默认 HTTP 500）。

```typescript
{ code: -1, message: "错误信息", data: null }
```

### 4.3 API 路由层 (`app/api/*/route.ts`)

| 路由 | 方法 | 请求体 | 响应格式 | 说明 |
|------|------|--------|----------|------|
| `/api/baseChat` | `POST` | `{ msg, systemMessage }` | `text/plain` 流 | 基础流式对话 |
| `/api/pipe` | `POST` | `{ msg }` | `text/plain` 流 | 管道流式对话 |

**错误处理**：异常时返回 JSON `{ message: string }`，HTTP 状态码 500。

### 4.4 前端组件

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
  1. 校验输入非空
  2. 追加用户消息 + 空的 AI 占位消息
  3. 发起 `fetch(API_ROUTES.PIPE, ...)`，携带 `AbortSignal`
  4. 使用 `TextDecoder` 逐块解码流数据
  5. 实时更新对应 AI 消息的 `content`
  6. 处理完成 / 错误 / 中断三种终止状态

- **`handleAbort()`**
  - 若流已开始（`readerRef` 存在）：`reader.cancel()`
  - 若仍在等待响应：`abortController.abort()`

#### `MsgBlock` (`components/Chat/MsgBlock/index.tsx`)

单条消息渲染组件。

| 属性 | 类型 | 说明 |
|------|------|------|
| `role` | `"human" \| "ai"` | 消息角色 |
| `content` | `string` | 消息内容（Markdown） |

**安全策略**：使用 `markdown-it` 渲染时设置 `html: false`，禁止原生 HTML 标签，降低 XSS 注入风险。

#### `Grainient` (`components/Grainient/index.tsx`)

WebGL 动态渐变背景组件，**Client Component**。

**技术实现**:
- 底层库: [`ogl`](https://github.com/oframe/ogl)（轻量级 WebGL 渲染器）
- 几何体: 全屏 `Triangle`
- Shader: 自定义 GLSL fragment shader（noise、warp、grain、blend 等效果）
- 动画: `requestAnimationFrame` 驱动 uniform `iTime`

**性能优化**:
- `ResizeObserver` 自适应容器尺寸
- `IntersectionObserver` 在不可见时暂停渲染
- `document.visibilitychange` 在后台标签页暂停渲染
- `WeakMap` 缓存 WebGL 上下文，避免重建

**可调参数**（完整 Props）:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `timeSpeed` | `number` | `0.25` | 时间流速 |
| `color1` | `string` | `"#FF9FFC"` | 主色 1 |
| `color2` | `string` | `"#5227FF"` | 主色 2 |
| `color3` | `string` | `"#B497CF"` | 主色 3 |
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

#### `NavTabs` (`components/NavTabs.tsx`)

顶部导航栏组件，**Client Component**。

- 使用 `usePathname()` 判断当前路由
- 毛玻璃效果：`backdrop-blur` + 半透明背景
- 三个 Tab：`HOME` / `CHAT` / `RAG`

### 4.5 配置中心 (`config.ts`)

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
| `OLLAMA_EMBED_MODEL` | `mxbai-embed-large:latest` | 嵌入模型名称（预留 RAG 使用） |
| `OLLAMA_TEMPERATURE` | `0.3` | 生成随机性，越低越确定性 |

### 4.6 路由与导航常量

**`constants/app.routes.ts`**

| 常量 | 值 | 说明 |
|------|-----|------|
| `APP_ROUTES.HOME` | `"/"` | 首页路径 |
| `APP_ROUTES.CHAT` | `"/chat"` | 聊天页路径 |
| `APP_ROUTES.RAG` | `"/rag"` | RAG 页路径 |
| `NAV_TABS` | `NavTab[]` | 导航栏配置数组 |

**`constants/api.routes.ts`**

| 常量 | 值 | 说明 |
|------|-----|------|
| `API_ROUTES.BASE_CHAT` | `"/api/baseChat"` | 基础聊天 API |
| `API_ROUTES.PIPE` | `"/api/pipe"` | 管道流式 API |

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
app/api/* ──────────────────────────────┐
   │                                      │
   ▼                                      │
lib/server/chat.ts ──► @langchain/ollama  │
   │              ──► @langchain/core      │
   │              ──► config.ts            │
   │                                      │
   ▼                                      │
lib/server/response.ts ◄─────────────────┘
   │
   ▼
types/api.ts

components/Chat/index.tsx ──► constants/api.routes.ts
   │                      ──► components/Chat/MsgBlock
   ▼
lib/api/client.ts ◄── (预留，当前 Chat 直接使用 fetch)

components/Grainient/index.tsx ──► ogl
components/NavTabs.tsx ──► constants/app.routes.ts
```

---

## 六、项目运行方式

### 6.1 前置依赖

1. **Node.js** >= 18
2. **pnpm**（推荐，或 npm / yarn / bun）
3. **Ollama** 本地服务已启动，且已拉取对应模型：
   ```bash
   # 启动 Ollama 服务
   ollama serve

   # 拉取聊天模型（默认 qwen3.5:4b）
   ollama pull qwen3.5:4b

   # 拉取嵌入模型（预留 RAG 使用，默认 mxbai-embed-large）
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

# 嵌入模型（RAG 预留）
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

---

## 七、扩展建议

### 7.1 RAG 模块实现路线

当前 `Rag` 组件为占位状态，可按以下路线扩展：

1. **文档上传与解析**：支持 PDF / Markdown / TXT 上传，提取文本块
2. **向量化存储**：使用 `@langchain/ollama` 的嵌入能力 + `MemoryVectorStore` 或外部向量数据库（如 Chroma / Pinecone）
3. **检索链构建**：`RetrievalQAChain` 或 LCEL 的 `createRetrievalChain`
4. **UI 增强**：增加文件上传组件、引用来源展示、相似度评分

### 7.2 会话持久化

- 当前 `Chat` 组件的消息存储在 React State 中，页面刷新即丢失
- 可接入 `localStorage` / `IndexedDB` / 后端数据库实现会话历史保存

### 7.3 多模型切换

- 在 `config.ts` 中扩展多模型配置数组
- 前端增加模型选择器，通过 API 参数动态切换 `ChatOllama` 实例

---

## 八、附录

### 8.1 TypeScript 路径别名

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

### 8.2 关键类型定义

```typescript
// types/api.ts
interface ApiResponse<T = unknown> {
  code: number;      // 0 表示成功，非 0 表示业务错误
  message: string;   // 提示信息
  data: T;           // 业务数据
}

// constants/app.routes.ts
type AppRouteKey = "home" | "chat" | "rag";
interface NavTab {
  key: AppRouteKey;
  label: string;
  href: string;
}

// components/Chat/MsgBlock/index.tsx
type MsgRole = "human" | "ai";
interface MsgBlockProps {
  role: MsgRole;
  content: string;
}
```

### 8.3 代码规范

- **框架**: Next.js App Router（React Server Components 优先）
- **样式**: Tailwind CSS v4，自定义 CSS 变量控制主题
- **字体**: Geist / Geist Mono（通过 `next/font/google` 自动优化加载）
- **Client Component 标识**: 需要浏览器 API 或交互的组件顶部标注 `"use client"`
- **流式响应格式**: 纯文本流（`text/plain; charset=utf-8`），非 SSE / EventStream

---

*文档生成时间：2026-07-17*
*对应代码版本：v0.1.0*
