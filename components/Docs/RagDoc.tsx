/** RAG 技术栈说明（/docs → RAG） */
const RagDoc = () => {
  return (
    <article className="docs-container">
      <h1 className="docs-title">如何基于本技术栈开发 RAG 项目</h1>

      <section className="docs-section">
        <h2 className="docs-heading">1. RAG 是什么</h2>
        <p className="docs-text">
          RAG（Retrieval-Augmented Generation，检索增强生成）让大模型在回答前先检索本地知识库中的相关片段，再基于检索结果生成答案。这样可以减少幻觉、引入私有数据，且无需重新训练模型。
        </p>
        <p className="docs-text">
          仓库内逐步说明见 <code className="docs-code">docs/RAG.md</code>，可对照 <code className="docs-code">/rag</code> 页面实操。
        </p>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">2. 本项目的 RAG 技术栈</h2>
        <ul className="docs-ul">
          <li><strong>Next.js 16</strong>：全栈框架，App Router 同时承载页面与 API。</li>
          <li><strong>React 19 + TypeScript</strong>：类型安全的组件开发。</li>
          <li><strong>Tailwind CSS v4</strong>：原子化样式，配合 <code className="docs-code">@utility</code> 统一组件类名。</li>
          <li><strong>LangChain + @langchain/ollama</strong>：模型调用、提示词模板、文档处理与向量检索链。</li>
          <li><strong>Ollama</strong>：本地运行大模型与嵌入模型。</li>
          <li><strong>markdown-it</strong>：前端渲染模型返回的 Markdown 答案。</li>
        </ul>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">3. RAG 整体流程</h2>
        <ol className="docs-list">
          <li>用户上传文档（PDF、Markdown、TXT 等）。</li>
          <li>将文档切分为固定大小的文本块（chunk）。</li>
          <li>使用嵌入模型将每个 chunk 转换为向量。</li>
          <li>把向量与原文一起存入向量数据库。</li>
          <li>用户提问时，用同样的嵌入模型把问题向量化。</li>
          <li>在向量库中检索最相似的 Top-K 片段。</li>
          <li>将检索结果拼接进提示词上下文，调用大模型生成答案。</li>
        </ol>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">4. 后端实现步骤</h2>
        <h3 className="docs-heading">4.1 安装依赖</h3>
        <pre className="docs-pre">
          <code>pnpm add @langchain/community langchain pdf-parse cheerio</code>
        </pre>
        <p className="docs-text">
          <code className="docs-code">@langchain/community</code> 提供 MemoryVectorStore、PDFLoader、CheerioWebBaseLoader 等组件；<code className="docs-code">pdf-parse</code> 用于解析 PDF；<code className="docs-code">cheerio</code> 用于解析网页。
        </p>

        <h3 className="docs-heading">4.2 文档加载与切分</h3>
        <pre className="docs-pre">
{`import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const loader = new PDFLoader("/path/to/file.pdf");
const docs = await loader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});
const chunks = await splitter.splitDocuments(docs);`}
        </pre>

        <h3 className="docs-heading">4.3 构建向量库</h3>
        <pre className="docs-pre">
{`import { OllamaEmbeddings } from "@langchain/ollama";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { modelConfig } from "@/config";

const embeddings = new OllamaEmbeddings({
  model: modelConfig.ollama.embedModel,
  baseUrl: modelConfig.ollama.host,
});

const vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings);`}
        </pre>

        <h3 className="docs-heading">4.4 检索与生成链</h3>
        <pre className="docs-pre">
{`import { ChatOllama } from "@langchain/ollama";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const model = new ChatOllama({
  model: modelConfig.ollama.chatModel,
  baseUrl: modelConfig.ollama.host,
  temperature: 0.3,
});

const prompt = ChatPromptTemplate.fromTemplate(\`
  你是一个技术助手，请基于以下上下文回答用户问题。
  上下文：\\n{context}\\n\\n问题：{input}
\`);

const combineDocsChain = await createStuffDocumentsChain({
  llm: model,
  prompt,
});

const retriever = vectorStore.asRetriever({ k: 4 });
const ragChain = await createRetrievalChain({
  combineDocsChain,
  retriever,
});

const answer = await ragChain.invoke({ input: "什么是 RAG？" });`}
        </pre>

        <h3 className="docs-heading">4.5 暴露为 API 路由</h3>
        <p className="docs-text">
          在 <code className="docs-code">app/api/rag/route.ts</code> 中接收用户问题，调用上述 RAG 链，并以纯文本流形式返回结果，复用项目已有的 <code className="docs-code">lib/server/chat.ts</code> 与响应工具。本仓库实际路径为 <code className="docs-code">/api/rag/upload|search|chat|status</code>。
        </p>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">5. 前端实现步骤</h2>
        <ol className="docs-list">
          <li>在 <code className="docs-code">components/Rag/index.tsx</code> 中替换占位内容，新增文件上传组件与聊天交互面板。</li>
          <li>上传文件后调用 <code className="docs-code">/api/rag/upload</code> 解析并建立向量库，或在前端直接读取文本后传给后端。</li>
          <li>参考 <code className="docs-code">components/Chat/index.tsx</code> 的流式请求逻辑，向 <code className="docs-code">/api/rag/chat</code> 发起提问并实时渲染返回的 Markdown。</li>
          <li>在消息气泡中展示引用来源，增强可信度。</li>
        </ol>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">6. 推荐扩展方向</h2>
        <ul className="docs-ul">
          <li>向量持久化：将 MemoryVectorStore 替换为 Chroma、Pinecone 或 PostgreSQL + pgvector（见「数据库」Tab）。</li>
          <li>多格式支持：增加 Word、Excel、网页链接解析。</li>
          <li>会话历史：保存用户提问与检索结果，支持多轮对话。</li>
          <li>重排序（Rerank）：检索后使用更小的模型对片段重新打分，提升相关性。</li>
          <li>引用溯源：在答案中标注每个结论对应的原文出处。</li>
        </ul>
      </section>

      <section className="docs-section">
        <h2 className="docs-heading">7. 注意事项</h2>
        <ul className="docs-ul">
          <li>确保 Ollama 已启动并拉取对应模型：<code className="docs-code">ollama pull {`{chatModel}`}</code> 与 <code className="docs-code">ollama pull {`{embedModel}`}</code>。</li>
          <li>chunkSize 与 chunkOverlap 需要根据文档类型反复调优。</li>
          <li>生产环境建议对上传文件做大小与类型校验，并在服务端隔离处理。</li>
        </ul>
      </section>
    </article>
  );
};

export default RagDoc;
