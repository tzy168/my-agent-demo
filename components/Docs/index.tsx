"use client";

import { useState } from "react";
import RagDoc from "./RagDoc";
import DatabaseDoc from "./DatabaseDoc";

type DocsTab = "rag" | "database";

const TABS: { key: DocsTab; label: string }[] = [
  { key: "rag", label: "RAG" },
  { key: "database", label: "数据库" },
];

const Docs = () => {
  const [tab, setTab] = useState<DocsTab>("rag");

  return (
    <div className="docs-scroll">
      <div className="docs-tabs" role="tablist" aria-label="文档分类">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "docs-tab docs-tab-active" : "docs-tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rag" ? <RagDoc /> : <DatabaseDoc />}
    </div>
  );
};

export default Docs;
