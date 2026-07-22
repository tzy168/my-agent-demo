# PostgreSQL + Prisma：从 0 到接入本项目

本文说明如何在本仓库（Next.js 16 App Router + `lib/server` + `ApiClient`）中接入 **PostgreSQL** 与 **Prisma**，并用「聊天会话持久化」作为贯穿示例。对应页面：`/docs` →「数据库」Tab。

> 当前仓库**尚未安装** Prisma / 数据库依赖；本文是可直接照抄落地的教程，不是已实现功能的说明。

---

## 0. 为什么要接数据库

本 demo 现在：

| 能力 | 现状 |
|------|------|
| Chat / RAG Chat | 纯前端内存消息，刷新即丢 |
| RAG 向量库 | `lib/server/rag.ts` 进程内数组，热重载清空 |

接上 PostgreSQL 后可以：

1. **会话持久化**：用户刷新 `/chat` 仍能看到历史  
2. **多轮上下文**：按 `conversationId` 从库里取最近 N 条再喂给模型  
3. **RAG 元数据**：文件名、chunk 文本、上传时间可查（向量可继续内存，或后续换 pgvector）

本教程先做第 1、2 点（结构化数据），第 3 点在文末点到为止。

---

## 1. 整体数据流（必读）

```
浏览器 UI (components/Chat)
  │  apiClient.post / fetch
  ▼
Next.js Route Handler (app/api/conversations/**)
  │  校验 body → 调 lib/server/*
  ▼
Prisma Client (lib/server/db.ts)          ← 仅服务端，禁止进 client 组件
  │  SQL（由 Prisma 生成）
  ▼
PostgreSQL
```

与现有 Chat 流式接口的关系：

```
用户发送消息
  │
  ├─① POST /api/conversations/:id/messages   ← 先落库 user 消息（JSON）
  │
  └─② POST /api/baseChat 或 /api/rag/chat    ← 再流式生成（text/plain）
        │
        └─③ 流结束后 POST .../messages       ← 再落库 assistant 消息

读历史：GET /api/conversations/:id → 前端渲染气泡
```

约定不变：

- JSON API → `{ code, message, data }`（`successResponse` / `errorResponse`）
- 流式 Chat → `text/plain`，**不要**包进 `ApiResponse`
- Prisma / `DATABASE_URL` 只出现在 `lib/server/` 与 API Route

---

## 2. 前置：跑起 PostgreSQL

### 方式 A：Docker（推荐）

```bash
docker run --name agent-pg \
  -e POSTGRES_USER=agent \
  -e POSTGRES_PASSWORD=agent \
  -e POSTGRES_DB=agent_demo \
  -p 5432:5432 \
  -d postgres:16
```

连接串：

```text
postgresql://agent:agent@localhost:5432/agent_demo?schema=public
```

### 方式 B：本机安装

安装 PostgreSQL 16+，建库建用户后，把上面的 URL 换成你的账号密码即可。

在项目根目录新建 `.env`（勿提交 Git）：

```env
DATABASE_URL="postgresql://agent:agent@localhost:5432/agent_demo?schema=public"
```

若已有 `.env.local`，Next.js 也会读；Prisma CLI 默认读 `.env`，建议至少在 `.env` 里放一份 `DATABASE_URL`。

---

## 3. 安装依赖

包管理器必须用 **pnpm**：

```bash
pnpm add @prisma/client
pnpm add -D prisma
```

初始化（生成 `prisma/schema.prisma`）：

```bash
pnpm exec prisma init
```

会创建：

```text
prisma/
  schema.prisma
.env                 # 若尚无，会写入 DATABASE_URL 模板
```

把 `schema.prisma` 里的 `provider` 确认成 `postgresql`，`url` 指向 `env("DATABASE_URL")`。

---

## 4. 设计 Schema（聊天会话）

编辑 `prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// 一次聊天会话（对应前端一个会话面板）
model Conversation {
  id        String    @id @default(cuid())
  title     String    @default("新对话")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
}

/// 单条消息：user / assistant / system
model Message {
  id             String       @id @default(cuid())
  conversationId String
  role           String       // "user" | "assistant" | "system"
  content        String
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
}
```

说明：

- `cuid()`：短、适合 URL，不必自己管自增 id  
- `onDelete: Cascade`：删会话时消息一起删  
- `role` 用 `String` 保持简单；生产可改成 Prisma `enum`

推表并生成 Client：

```bash
pnpm exec prisma migrate dev --name init_chat
```

等价拆分（了解即可）：

```bash
pnpm exec prisma db push          # 开发期直接改库结构（无迁移历史）
pnpm exec prisma generate         # 只生成 @prisma/client
pnpm exec prisma studio           # 可视化看表
```

在 `package.json` 可加脚本（可选）：

```json
{
  "scripts": {
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate"
  }
}
```

---

## 5. PrismaClient 单例（Next.js 必做）

开发态 `pnpm dev` 会热重载，每次 `new PrismaClient()` 会多占连接，容易把 Postgres 打满。

新建 `lib/server/db.ts`：

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** 服务端唯一 Prisma 入口；禁止在 client 组件 import */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

在 `lib/server/index.ts` 导出（与现有 barrel 一致）：

```ts
export { prisma } from "./db";
```

---

## 6. 服务端业务函数

新建 `lib/server/conversations.ts`（业务与 Route 分离，和 `rag.ts` / `chat.ts` 同层）：

```ts
import { prisma } from "./db";

/** 创建会话 */
export async function createConversation(title = "新对话") {
  return prisma.conversation.create({
    data: { title },
  });
}

/** 列出会话（最新在前） */
export async function listConversations() {
  return prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 1, // 可选：只带首条当预览
      },
    },
  });
}

/** 取会话 + 全部消息 */
export async function getConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

/** 追加一条消息，并触摸会话 updatedAt */
export async function appendMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
) {
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, role, content },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
  return message;
}

/** 取最近 N 条，拼成喂模型的 history（不含 system 也可） */
export async function getRecentMessages(conversationId: string, take = 20) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take,
  }).then((rows) => rows.reverse());
}
```

导出：

```ts
// lib/server/index.ts
export {
  createConversation,
  listConversations,
  getConversation,
  appendMessage,
  getRecentMessages,
} from "./conversations";
```

---

## 7. API Route（JSON，走统一响应）

### 7.1 创建 / 列表

`app/api/conversations/route.ts`：

```ts
import {
  createConversation,
  listConversations,
  successResponse,
  errorResponse,
} from "@/lib/server";

export async function GET() {
  try {
    const data = await listConversations();
    return successResponse(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "list failed";
    return errorResponse(message);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { title?: string };
    const data = await createConversation(body.title?.trim() || "新对话");
    return successResponse(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "create failed";
    return errorResponse(message);
  }
}
```

### 7.2 单会话详情

`app/api/conversations/[id]/route.ts`：

```ts
import { getConversation, successResponse, errorResponse } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params; // Next.js 15+ params 为 Promise
    const data = await getConversation(id);
    if (!data) return errorResponse("conversation not found", -1, 404);
    return successResponse(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "get failed";
    return errorResponse(message);
  }
}
```

> 本项目是 Next.js **16**：动态路由 `params` 按官方文档当作 `Promise` 解包（见 `node_modules/next/dist/docs/`）。

### 7.3 追加消息

`app/api/conversations/[id]/messages/route.ts`：

```ts
import { appendMessage, successResponse, errorResponse } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { role?: string; content?: string };
    const role = body.role;
    const content = body.content?.trim();

    if (!content) return errorResponse("content required", -1, 400);
    if (role !== "user" && role !== "assistant" && role !== "system") {
      return errorResponse("invalid role", -1, 400);
    }

    const data = await appendMessage(id, role, content);
    return successResponse(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "append failed";
    return errorResponse(message);
  }
}
```

### 7.4 路由常量

在 `constants/api.routes.ts` 追加：

```ts
export const CONVERSATIONS = "/api/conversations";
export const conversationById = (id: string) => `/api/conversations/${id}`;
export const conversationMessages = (id: string) =>
  `/api/conversations/${id}/messages`;
```

---

## 8. 前端怎么用（ApiClient）

本项目已有 `lib/api/client.ts`：专吃 `{ code, message, data }`。

类型可放在 `types/api.ts`：

```ts
export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRow = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: ChatMessageRow[];
};
```

在 Chat 组件里（示意，按需接入现有 `components/Chat`）：

```ts
import { apiClient } from "@/lib/api/client";
import {
  CONVERSATIONS,
  conversationById,
  conversationMessages,
} from "@/constants/api.routes";
import type { ConversationDetail, ChatMessageRow } from "@/types/api";

// 新建会话
const conv = await apiClient.post<{ id: string }>(CONVERSATIONS, {
  title: "学习 Prisma",
});

// 拉历史
const detail = await apiClient.get<ConversationDetail>(
  conversationById(conv.id),
);

// 用户消息落库
await apiClient.post<ChatMessageRow>(conversationMessages(conv.id), {
  role: "user",
  content: userText,
});

// ……再调现有流式 /api/baseChat，拼完 assistant 全文后再：
await apiClient.post<ChatMessageRow>(conversationMessages(conv.id), {
  role: "assistant",
  content: fullAssistantText,
});
```

流式部分**继续**用 `fetch` + `getReader()`（与现有 Chat 一致），不要用 `apiClient` 读流。

---

## 9. 与现有 Chat 拼在一起的时序

```
[前端] 用户点发送
   │
   ├─ appendMessage(user)          JSON
   ├─ 本地乐观更新气泡
   ├─ fetch(/api/baseChat) stream  text/plain
   │     └─ 边读边 setState
   └─ 流结束 → appendMessage(assistant)  JSON
```

若希望「模型也看到历史」，改 `lib/server/chat.ts` / Route：多收一个 `conversationId`，在 stream 前：

```ts
const history = await getRecentMessages(conversationId, 12);
// 转成 LangChain Message[] 再 stream
```

数据再流一层：

```
PG Message 表 → getRecentMessages → ChatOllama.stream → 浏览器
```

---

## 10. 文件落点一览

落地后建议目录（与现有结构对齐）：

```text
prisma/
  schema.prisma
  migrations/           # migrate dev 自动生成
lib/server/
  db.ts                 # Prisma 单例
  conversations.ts      # CRUD
  index.ts              # 再导出
app/api/conversations/
  route.ts              # GET 列表 / POST 创建
  [id]/route.ts         # GET 详情
  [id]/messages/route.ts
.env                    # DATABASE_URL（勿提交）
docs/DATABASE.md        # 本文
```

**不要**把 `prisma` 或 `lib/server/db` import 进 `"use client"` 组件。

---

## 11.（进阶）RAG 持久化与 pgvector

当前 RAG 是内存数组。持久化可分两档：

### 档 A：只存原文与元数据

```prisma
model RagDocument {
  id        String   @id @default(cuid())
  source    String
  content   String
  createdAt DateTime @default(now())
  chunks    RagChunk[]
}

model RagChunk {
  id         String      @id @default(cuid())
  documentId String
  content    String
  // embedding 先不存，或存成 Float[] JSON（检索仍要自己算）
  embedding  Json?
  document   RagDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
}
```

`ingestText` 写完内存后顺便 `prisma.ragChunk.createMany`；进程重启可从库重建内存索引。

### 档 B：pgvector（真·向量库）

1. Postgres 装扩展：`CREATE EXTENSION IF NOT EXISTS vector;`  
2. Prisma 对 `vector` 支持有限，常用 raw SQL / 社区扩展存 embedding  
3. 检索改为 `ORDER BY embedding <=> $1 LIMIT k`

学习路径建议：先档 A 把「上传记录不丢」做稳，再上 pgvector。

---

## 12. 常见坑

| 现象 | 原因 | 处理 |
|------|------|------|
| `Can't reach database server` | Postgres 没起 / 端口错 | `docker ps`，检查 `DATABASE_URL` |
| 开发一会后连接耗尽 | 多次 `new PrismaClient` | 用第 5 节单例 |
| `PrismaClient is unable to run in browser` | client 组件 import 了 prisma | 只从 `lib/server` / Route 用 |
| `params.id` 是 Promise | Next 15+ 动态路由 | `const { id } = await ctx.params` |
| migrate 改了 schema 但代码类型旧 | 未 generate | 再跑 `prisma generate` / `migrate dev` |
| `.env` 有值但 API 仍空 | 改 env 后未重启 `pnpm dev` | 重启 Next |

---

## 13. 命令速查

```bash
# 依赖
pnpm add @prisma/client
pnpm add -D prisma

# 库
docker start agent-pg   # 或上文 docker run
pnpm exec prisma migrate dev --name init_chat
pnpm exec prisma studio

# 应用
pnpm dev
```

验证清单：

1. `prisma studio` 能看到 `Conversation` / `Message`  
2. `POST /api/conversations` 返回 `code: 0` 且带 `id`  
3. `POST .../messages` 后 `GET .../:id` 能看到消息  
4. Chat 流式接口仍返回纯文本，不受 JSON 包装影响  

---

## 14. 和本仓库其它文档的关系

| 文档 | 内容 |
|------|------|
| `docs/RAG.md` | 上传 → 切分 → 嵌入 → 检索 → 流式生成 |
| `docs/DATABASE.md`（本文） | PostgreSQL + Prisma 接入与会话持久化 |
| `/docs` 页面 | 浏览器内可读的精简/对照版 |

做完会话持久化后，下一步自然是：RAG chunk 落库，或把 `MemoryVectorStore` 换成 pgvector。
