import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import MarkdownIt from "markdown-it";

type DocId = "rag" | "database";

const DOCS: { id: DocId; label: string; file: string }[] = [
  { id: "rag", label: "RAG", file: "RAG.md" },
  { id: "database", label: "数据库", file: "DATABASE.md" },
];

// 与 MsgBlock 一致：关闭原生 HTML，降低 XSS 面
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

function renderDoc(file: string) {
  const raw = fs.readFileSync(path.join(process.cwd(), "docs", file), "utf8");
  return md.render(raw);
}

type DocsProps = {
  doc?: string;
};

/** /docs：左侧目录 + 直接渲染 docs/*.md */
const Docs = ({ doc }: DocsProps) => {
  const active = DOCS.find((d) => d.id === doc) ?? DOCS[0];
  const html = renderDoc(active.file);

  return (
    <div className="docs-layout">
      <nav className="docs-nav" aria-label="文档目录">
        {DOCS.map((d) => (
          <Link
            key={d.id}
            href={d.id === "rag" ? "/docs" : `/docs?doc=${d.id}`}
            className={
              d.id === active.id
                ? "docs-nav-link docs-nav-link-active"
                : "docs-nav-link"
            }
          >
            {d.label}
          </Link>
        ))}
      </nav>
      <article
        className="docs-article"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

export default Docs;
