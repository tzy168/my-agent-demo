# AI Agent 学习迭代计划

> 面向 1.5 年前端工程师，基于当前 `my-agent-demo` 项目逐步学习 AI Agent 开发。

---

## 写在前面

当前项目已经跑通了两个核心能力：

1. **流式对话**：基于 Ollama 本地大模型的 `/chat` 页面。
2. **RAG 检索增强**：基于内存向量库的 `/rag` 页面（上传 → 切块 → 嵌入 → 检索 → 生成）。

本计划以此为起点，从“看懂代码”到“独立做 Agent”，分 6 个阶段推进。每个阶段都落地到当前仓库的代码改造上，边做边学。

---

## 迭代总览

| 阶段 | 主题 | 目标 | 预计周期 |
|:--:|------|------|:--:|
| 1 | 吃透现有代码 | 能独立讲清楚每个文件的作用和数据流 | 3~5 天 |
| 2 | 工程化加固 | 把 Demo 改成可维护的项目结构 | 1 周 |
| 3 | Agent 基础：工具调用 | 让模型能调用本地函数 / 外部 API | 1~1.5 周 |
| 4 | Agent 进阶：记忆与多轮 | 引入会话历史、长期记忆 | 1 周 |
| 5 | 多 Agent / 工作流 | 用 LangGraph 或手写编排实现多角色协作 | 1.5~2 周 |
| 6 | 生产化与部署 | 持久化、错误处理、监控、部署 | 1~2 周 |

---

## 阶段一：吃透现有代码（3~5 天）

### 目标

不急着加功能，先能独立画出请求流、改得动代码。

### 任务清单

| 任务 | 具体做法 | 产出 |
|------|----------|------|
| 通读项目文档 | 对照 `CODE_WIKI.md` 与 `docs/RAG.md` 看源码，确认每个函数在哪被调用 | 能口述 `/chat` 和 `/rag` 的完整数据流 |
| 跟调一次 `/chat` | 从 `components/Chat/index.tsx` 的 `handleSubmit` 跟到 `lib/server/chat.ts` 的 `streamWithPipe` | 理解 `ReadableStream` + `AbortController` |
| 跟调一次 `/rag` | 从上传 → 切块 → 嵌入 → 检索 → 注入 Prompt → 流式生成 | 理解 RAG 为什么能“减少胡说” |
| 做一个小改动 | 把 Chat 默认调用从 `/api/pipe` 改成 `/api/baseChat`，并加一个可切换 system prompt 的输入框 | 一次端到端改动 |
| 回答 3 个关键问题 | 1) `store` 为什么进程重启就清空？2) `X-Rag-Hits` 响应头怎么在前端解析？3) `markdown-it` 为什么设置 `html: false`？ | 检验理解 |

### 学习重点

- 流式响应原理
- Client / Server 边界
- `use client` 的使用时机
- LangChain 基本抽象：`ChatOllama`、`ChatPromptTemplate`、`StringOutputParser`

---

## 阶段二：工程化加固（1 周）

### 目标

把“能跑”的 Demo 改成“好维护”的项目，为后续 Agent 功能打基础。

### 任务清单

| 任务 | 具体做法 | 产出 |
|------|----------|------|
| 统一组件导出 | 把 `Chat`、`Rag`、`Home`、`Grainient` 也加入 `components/index.ts` barrel export | 全站统一从 `@/components` 导入 |
| 抽离通用 Hook | 把 `Chat` 和 `Rag` 里重复的流式请求逻辑抽成 `useStreamingChat(apiRoute)` | 两个页面共用同一套流式逻辑 |
| 类型收敛 | 把 `RagHit`、`RagStatus`、`MsgRole` 等局部类型移到 `types/` 目录 | 前后端共享类型 |
| API 错误统一处理 | 在 `lib/api/client.ts` 基础上，封装 `useApi()` Hook 或引入 SWR / TanStack Query | RAG 上传 / 检索 / 状态用统一请求层 |
| 加单元测试 | 给 `cosineSimilarity`、`splitText`、`toTextContent` 写测试（Vitest 或 Node Test Runner） | 跑通第一个测试 |
| 环境变量校验 | 在 `config.ts` 增加启动时校验（如 `OLLAMA_HOST` 是否可访问） | 启动失败时给出明确提示 |

### 学习重点

- TypeScript 类型设计
- React Hooks 抽象
- 前端请求层封装
- 基础单元测试

---

## 阶段三：Agent 基础 — 工具调用（1~1.5 周）

### 目标

让大模型不仅能“聊天”，还能“调用工具”完成任务，这是 Agent 的核心。

### 任务清单

| 任务 | 具体做法 | 产出 |
|------|----------|------|
| 理解 Tool / Function Calling | 学习 LangChain 的 `tool`、`bindTools`、`ToolNode` | 能在白板上画出“模型 → 决定调用 → 执行 → 返回结果 → 再生成”的循环 |
| 新增 `/api/agent/chat` | 给模型绑定 2~3 个工具：`getWeather(city)`、`searchWeb(query)`、`calculate(expression)` | 一个能调用工具的 Agent API |
| 新增 Agent Chat 页面 | 在 `/agent` 路由做一个新页面，展示“模型思考 → 调用工具 → 最终结果”的过程 | 可视化工具调用链路 |
| 工具结果回注 | 把工具执行结果以 `ToolMessage` 形式塞回对话，让模型继续生成 | 多轮工具调用能闭环 |
| 让 RAG 变成其中一个 Tool | 把 `/api/rag/chat` 包装成 `ragQueryTool`，让 Agent 自己决定要不要查知识库 | Agent 能按需检索 |

### 学习重点

- Tool Schema 定义
- Function Calling 协议
- `AIMessage` / `ToolMessage` / `HumanMessage` 的流转

---

## 阶段四：Agent 进阶 — 记忆与多轮（1 周）

### 目标

Agent 能记住上下文，支持长时间对话。

### 任务清单

| 任务 | 具体做法 | 产出 |
|------|----------|------|
| 会话历史存储 | 用 PostgreSQL / SQLite / Redis 保存每轮对话（用户 ID + 会话 ID） | 刷新页面后历史不丢 |
| 新增会话列表 UI | 在 Chat / Agent 页面左侧加会话抽屉：新建会话、切换、删除 | 类似 ChatGPT 的侧边栏 |
| 窗口记忆管理 | 实现 `trimMessages` 或按 token 截断，防止上下文超限 | 长对话不爆上下文 |
| 长期记忆（选做） | 把重要事实摘要后写入向量库，后续自动检索 | Agent 能“记住”用户偏好 |
| RAG 支持多轮 | 让 RAG Chat 带上历史，检索时把历史问题也纳入考量 | 追问更准确 |

### 学习重点

- 消息历史管理
- Token 限制与截断策略
- 数据库基础
- RAG 与对话历史的结合

---

## 阶段五：多 Agent / 工作流（1.5~2 周）

### 目标

从“一个 Agent”进化到“多个 Agent 协作”。

### 任务清单

| 任务 | 具体做法 | 产出 |
|------|----------|------|
| 学习 LangGraph | 理解 `StateGraph`、`node`、`edge`、`conditional_edge` | 能画出状态图 |
| 实现“代码助手”工作流 | 路由：接收问题 → 判断是“写代码”还是“查知识库” → 分发到 `CoderAgent` 或 `RagAgent` → 汇总生成答案 | 一个可运行的多 Agent 流程 |
| 增加“审核 Agent” | `CoderAgent` 写完后，`ReviewerAgent` 检查并给出修改建议，最后汇总输出 | 看到 Agent 之间的协作 |
| 新增可视化工作流页面 | 用 React Flow 或手写 SVG，实时展示当前走到哪个节点 | 工作流可观测 |
| 支持人工确认节点 | 某些步骤（如发送邮件、执行命令）暂停，等用户点击“继续” | 人在回路（Human-in-the-loop） |

### 学习重点

- LangGraph 状态机
- 多 Agent 编排
- Human-in-the-loop

---

## 阶段六：生产化与部署（1~2 周）

### 目标

让项目从本地 Demo 变成可给别人用的产品。

### 任务清单

| 任务 | 具体做法 | 产出 |
|------|----------|------|
| 向量库持久化 | 把内存 `store` 换成 Chroma / pgvector / LanceDB | 重启后知识库还在 |
| 多格式文档解析 | 支持 PDF、Word、网页 URL | RAG 不再局限于 txt/md |
| 错误处理与重试 | 给 Ollama 调用加指数退避重试、超时降级 | 服务更稳定 |
| 日志与监控 | 记录每次 LLM 调用耗时、token 数、工具调用结果 | 可分析性能 |
| 部署 | 用 Docker 打包，部署到 Vercel / 自有服务器 | 线上可访问 |
| 文档收尾 | 更新 `README.md`、`docs/` 和 `CODE_WIKI.md` | 项目对外可交付 |

### 学习重点

- 向量数据库选型
- Docker 与部署
- 可观测性基础

---

## 推荐学习资源

按阶段搭配：

| 阶段 | 推荐资源 |
|------|----------|
| 1~2 | 本项目源码 + [LangChain JS 官方文档](https://js.langchain.com/docs/introduction/) |
| 3 | LangChain “Tool calling” 章节、OpenAI Function Calling 指南 |
| 4 | LangChain “Memory” 概念、Buffer Memory / VectorStore Memory |
| 5 | [LangGraph 官方教程](https://langchain-ai.github.io/langgraphjs/) |
| 6 | Docker 基础、Vercel 部署文档、pgvector / Chroma 文档 |

---

## 建议的学习节奏

- **工作日每晚 1.5~2 小时**：推进一个具体任务，不要只看文档。
- **周末半天**：做阶段总结，把本周改动的代码整理进 `CODE_WIKI.md` 或写一段学习笔记。
- **每阶段结束**：给自己一个小里程碑，比如“今天 Agent 能调用天气工具了”。

---

*创建时间：2026-07-22*  
*对应项目：my-agent-demo v0.1.0*
