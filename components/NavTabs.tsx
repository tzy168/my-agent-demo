"use client";

import { APP_ROUTES, isNavTabActive, NAV_TABS } from "@/constants/app.routes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavTabsProps = {
  children: React.ReactNode;
};

type Theme = "light" | "dark";

const THEME_KEY = "th-theme";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

export function NavTabs({ children }: NavTabsProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  const settingsActive = isNavTabActive(pathname, APP_ROUTES.SETTINGS);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // localStorage 不可用时仍切换本次会话主题
    }
    setTheme(next);
  };

  return (
    <div className="page-stack">
      {/* 毛玻璃顶栏：半透明 surface + backdrop-blur */}
      <div className="nav-glass">
        <div className="nav-brand">TH</div>
        <nav className="nav-tabs">
          {NAV_TABS.map((tab: { key: string; href: string; label: string }) => {
            const isActive = isNavTabActive(pathname, tab.href);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={
                  "nav-tab " + (isActive ? "nav-tab-active" : "nav-tab-idle")
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="nav-actions">
          {/* 设置入口：齿轮图标，与主题按钮并列靠右 */}
          <Link
            href={APP_ROUTES.SETTINGS}
            className={
              "nav-icon-btn nav-icon-btn-hover" +
              (settingsActive ? " nav-icon-btn-active" : "")
            }
            aria-label="设置"
            title="设置"
            aria-current={settingsActive ? "page" : undefined}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <path
                d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .1 1.7 1.7 0 0 0-1.05 1.55V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.1-1 1.7 1.7 0 0 0-1.55-1.05H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.1A1.7 1.7 0 0 0 11.05 2.95V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 16.1 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.32.1.66.1 1a1.7 1.7 0 0 0 1.55 1.05H21a2 2 0 1 1 0 4h-.1A1.7 1.7 0 0 0 19.4 15Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          {/* 主题切换：圆形按钮，hover 微旋，localStorage 持久化 */}
          <button
            type="button"
            className="nav-icon-btn nav-icon-btn-hover"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
            title={theme === "dark" ? "浅色" : "深色"}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
                <path
                  d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 内容区占满剩余高度，禁止整页滚动，子页面自行控制内部滚动 */}
      <div className="page-content">{children}</div>
    </div>
  );
}
