"use client";
import { useState } from "react";
import Chat from "./Chat";
import Rag from "./Rag";
import Home from "./Home";

type TabKey = "home" | "chat" | "rag";

// 顶部导航的 tab 配置：label 为展示名，content 为该 tab 下内容区占位文字
const TABS: { key: TabKey; label: string; content: React.ReactNode }[] = [
  { key: "home", label: "HOME", content: <Home /> },
  { key: "chat", label: "CHAT", content: <Chat /> },
  { key: "rag", label: "RAG", content: <Rag /> },
];

export function NavTabs() {
  const [active, setActive] = useState<TabKey>("home");
  const current = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      <div className="flex items-center w-full shrink-0 border-b border-black/[.08] dark:border-white/[.145]">
        <div className="text-2xl font-bold  pl-4">REFEAI</div>
        <nav className="flex w-full  items-center gap-2 px-4 py-3">
          {TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActive(t.key)
                }}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                  (isActive
                    ? "bg-foreground text-background"
                    : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-[#1a1a1a]")
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="w-full flex-1 min-h-0 p-4">
        {current.content}
      </div>
    </div>
  );
}
