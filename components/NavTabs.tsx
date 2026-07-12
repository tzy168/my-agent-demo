"use client";

import { isNavTabActive, NAV_TABS } from "@/constants/app.routes";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavTabsProps = {
  children: React.ReactNode;
};

export function NavTabs({ children }: NavTabsProps) {
  const pathname = usePathname();

  return (
    <div className="page-stack">
      {/* 毛玻璃顶栏：半透明底 + backdrop-blur，滚动内容可透出模糊层 */}
      <div className="nav-glass">
        <div className="nav-brand">TH</div>
        <nav className="nav-tabs">
          {NAV_TABS.map((tab: any) => {
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
      </div>

      {/* 内容区占满剩余高度，禁止整页滚动，子页面自行控制内部滚动 */}
      <div className="page-content">{children}</div>
    </div>
  );
}
