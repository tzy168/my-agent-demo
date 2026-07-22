/**
 * PostgreSQL + Prisma 接入教程（/docs → 数据库）
 * 完整 Markdown 版：docs/DATABASE.md
 */
const DatabaseDoc = () => {
  return (
    <article className="docs-container">
      <h1 className="docs-title">PostgreSQL + Prisma 接入本项目</h1>
      <p className="docs-text">
        按本仓库现有分层（<code className="docs-code">app/api</code> → <code className="docs-code">lib/server</code> → 外部服务）接入数据库，贯穿示例是「聊天会话持久化」。仓库里目前<strong>还没装</strong> Prisma，以下代码可直接照抄落地。完整版见 <code className="docs-code">docs/DATABASE.md</code>。
      </p>

      <section className="docs-section">
        <h2 className="docs-heading">1. 整体数据流</h2>
        <pre className="docs-pre">{`浏览器 UI (components/Chat)
  │  apiClient.post / fetch
  ▼
Next.js Route Handler (app/api/conversations/**)
  │  校验 body → 调 lib/server/*
  ▼
Prisma Client (lib/server/db.ts)   ← 仅服务端
  │  SQL
  ▼
PostgreSQL`}</pre>
        <p className="docs-text">与现有流式 Chat 的配合（不要用 JSON 包流）：</p>
        <pre className="docs-pre">{`用户发送
  ├─① POST /api/conversations/:id/messages   落库 user（JSON）
  ├─② POST /api/baseChat 或 /api/rag/chat     流式生成（text/plain）
  └─③ 流结束后再 POST .../messages           落库 assistant（JSON）

读历史：GET /api/conversations/:id → 渲染气泡`}</pre>
        <ul className="docs-ul">
          <li>JSON API 继续用 <code className="docs-code">successResponse</code> / <code className="docs-code">errorResponse</code>（<code className="docs-code">{"{ code, message, data }"}</code>）。</li>
          <li>流式接口保持 <code className="docs-code">text/plain</code>。</li>
          <li><code className="docs-code">PrismaClient</code> / <code className="docs-code">DATABASE_URL</code> 禁止进 <code className="docs-code">&quot;use client&quot;</code> 组件。</li>
        </ul>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">2. 启动 PostgreSQL</h2>
        <p className="docs-text">推荐 Docker：</p>
        <pre className="docs-pre">
{`docker run --name agent-pg \\
  -e POSTGRES_USER=agent \\
  -e POSTGRES_PASSWORD=agent \\
  -e POSTGRES_DB=agent_demo \\
  -p 5432:5432 \\
  -d postgres:16`}
        </pre>
        <p className="docs-text">
          项目根目录 <code className="docs-code">.env</code>（勿提交）：
        </p>
        <pre className="docs-pre">
{`DATABASE_URL="postgresql://agent:agent@localhost:5432/agent_demo?schema=public"`}
        </pre>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">3. 安装 Prisma</h2>
        <pre className="docs-pre">
{`pnpm add @prisma/client
pnpm add -D prisma
pnpm exec prisma init`}
        </pre>
        <p className="docs-text">
          会生成 <code className="docs-code">prisma/schema.prisma</code>。确认 <code className="docs-code">provider = &quot;postgresql&quot;</code>，且 <code className="docs-code">url = env(&quot;DATABASE_URL&quot;)</code>。
        </p>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">4. Schema：会话与消息</h2>
        <pre className="docs-pre">
{`generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Conversation {
  id        String    @id @default(cuid())
  title     String    @default("新对话")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  role           String       // "user" | "assistant" | "system"
  content        String
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(
    fields: [conversationId],
    references: [id],
    onDelete: Cascade
  )

  @@index([conversationId, createdAt])
}`}
        </pre>
        <pre className="docs-pre">
          <code>pnpm exec prisma migrate dev --name init_chat</code>
        </pre>
        <p className="docs-text">
          可选：<code className="docs-code">prisma studio</code> 可视化看表；开发期也可用 <code className="docs-code">prisma db push</code>（无迁移历史）。
        </p>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">5. PrismaClient 单例</h2>
        <p className="docs-text">
          <code className="docs-code">pnpm dev</code> 热重载会反复执行模块；每次 <code className="docs-code">new PrismaClient()</code> 会占连接。挂到 <code className="docs-code">globalThis</code>：
        </p>
        <pre className="docs-pre">
{`// lib/server/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}`}
        </pre>
        <p className="docs-text">
          在 <code className="docs-code">lib/server/index.ts</code> 再导出 <code className="docs-code">prisma</code>，与现有 barrel 一致。
        </p>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">6. 服务端业务层</h2>
        <p className="docs-text">
          新建 <code className="docs-code">lib/server/conversations.ts</code>（和 <code className="docs-code">rag.ts</code> 同层，Route 只做校验与响应）：
        </p>
        <pre className="docs-pre">
{`import { prisma } from "./db";

export async function createConversation(title = "新对话") {
  return prisma.conversation.create({ data: { title } });
}

export async function listConversations() {
  return prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
}

export async function getConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

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

export async function getRecentMessages(
  conversationId: string,
  take = 20,
) {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.reverse();
}`}
        </pre>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">7. API Route 示例</h2>
        <h3 className="docs-heading">7.1 列表 / 创建</h3>
        <pre className="docs-pre">
{`// app/api/conversations/route.ts
import {
  createConversation,
  listConversations,
  successResponse,
  errorResponse,
} from "@/lib/server";

export async function GET() {
  try {
    return successResponse(await listConversations());
  } catch (e) {
    return errorResponse(
      e instanceof Error ? e.message : "list failed",
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
    };
    const data = await createConversation(
      body.title?.trim() || "新对话",
    );
    return successResponse(data);
  } catch (e) {
    return errorResponse(
      e instanceof Error ? e.message : "create failed",
    );
  }
}`}
        </pre>

        <h3 className="docs-heading">7.2 详情（注意 Next 16 的 params）</h3>
        <pre className="docs-pre">
{`// app/api/conversations/[id]/route.ts
import {
  getConversation,
  successResponse,
  errorResponse,
} from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params; // Next 15+ 为 Promise
    const data = await getConversation(id);
    if (!data) return errorResponse("not found", -1, 404);
    return successResponse(data);
  } catch (e) {
    return errorResponse(
      e instanceof Error ? e.message : "get failed",
    );
  }
}`}
        </pre>

        <h3 className="docs-heading">7.3 追加消息</h3>
        <pre className="docs-pre">
{`// app/api/conversations/[id]/messages/route.ts
import {
  appendMessage,
  successResponse,
  errorResponse,
} from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      role?: string;
      content?: string;
    };
    const content = body.content?.trim();
    const role = body.role;

    if (!content) return errorResponse("content required", -1, 400);
    if (
      role !== "user" &&
      role !== "assistant" &&
      role !== "system"
    ) {
      return errorResponse("invalid role", -1, 400);
    }

    return successResponse(await appendMessage(id, role, content));
  } catch (e) {
    return errorResponse(
      e instanceof Error ? e.message : "append failed",
    );
  }
}`}
        </pre>
        <p className="docs-text">
          在 <code className="docs-code">constants/api.routes.ts</code> 增加路径常量，前端统一引用。
        </p>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">8. 前端：ApiClient + 流式</h2>
        <pre className="docs-pre">
{`import { apiClient } from "@/lib/api/client";
import {
  CONVERSATIONS,
  conversationById,
  conversationMessages,
} from "@/constants/api.routes";

const conv = await apiClient.post<{ id: string }>(CONVERSATIONS, {
  title: "学习 Prisma",
});

await apiClient.post(conversationMessages(conv.id), {
  role: "user",
  content: userText,
});

// 流式仍用 fetch + getReader（现有 Chat 逻辑），不要用 apiClient
// 流结束后：
await apiClient.post(conversationMessages(conv.id), {
  role: "assistant",
  content: fullAssistantText,
});

const detail = await apiClient.get(conversationById(conv.id));`}
        </pre>
        <p className="docs-text">发送时序：</p>
        <ol className="docs-list">
          <li>落库 user 消息（JSON）。</li>
          <li>本地乐观更新气泡，再 <code className="docs-code">fetch</code> 流式接口。</li>
          <li>流结束，落库 assistant 全文（JSON）。</li>
        </ol>
        <p className="docs-text">
          若要让模型带历史：Route 多收 <code className="docs-code">conversationId</code>，stream 前调用 <code className="docs-code">getRecentMessages</code> 转成 LangChain Message。
        </p>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">9. 建议文件落点</h2>
        <pre className="docs-pre">{`prisma/schema.prisma
prisma/migrations/
lib/server/db.ts
lib/server/conversations.ts
app/api/conversations/route.ts
app/api/conversations/[id]/route.ts
app/api/conversations/[id]/messages/route.ts
.env                    # DATABASE_URL，勿提交
docs/DATABASE.md`}</pre>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">10. 进阶：RAG 持久化 / pgvector</h2>
        <ul className="docs-ul">
          <li>
            <strong>档 A</strong>：表存文档与 chunk 原文；重启后从库重建内存向量索引。
          </li>
          <li>
            <strong>档 B</strong>：Postgres <code className="docs-code">CREATE EXTENSION vector</code>，embedding 用 raw SQL / 社区扩展检索（<code className="docs-code">{"<=>"}</code>）。
          </li>
        </ul>
        <p className="docs-text">
          学习路径：先把会话 CRUD 跑通，再上 RAG 落库，最后才上 pgvector。
        </p>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">11. 常见坑</h2>
        <ul className="docs-ul">
          <li>连不上库 → 检查 Docker / <code className="docs-code">DATABASE_URL</code>，改 env 后重启 <code className="docs-code">pnpm dev</code>。</li>
          <li>连接耗尽 → 必须用第 5 节单例。</li>
          <li>浏览器报 Prisma 错误 → 不要在 client 组件 import prisma。</li>
          <li><code className="docs-code">params.id</code> 是 Promise → <code className="docs-code">await ctx.params</code>（Next 16）。</li>
          <li>类型对不上 → 改 schema 后重新 <code className="docs-code">migrate dev</code> / <code className="docs-code">generate</code>。</li>
        </ul>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">12. 验证清单</h2>
        <ol className="docs-list">
          <li><code className="docs-code">pnpm exec prisma studio</code> 能看到 Conversation / Message。</li>
          <li><code className="docs-code">POST /api/conversations</code> 返回 <code className="docs-code">code: 0</code> 且有 id。</li>
          <li>追加消息后再 <code className="docs-code">GET /api/conversations/:id</code> 能读到。</li>
          <li>原有 <code className="docs-code">/api/baseChat</code> 流式仍是纯文本。</li>
        </ol>
      </section>
    </article>
  );
};

export default DatabaseDoc;
