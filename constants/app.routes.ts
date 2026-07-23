/** 前端页面路由 key，与 Tab 一一对应 */
export type AppRouteKey = "home" | "chat" | "rag" | "docs" | "settings";

export type NavTab = {
  key: AppRouteKey;
  label: string;
  href: string;
};

/** 应用页面路径常量 */
export const APP_ROUTES = {
  HOME: "/",
  CHAT: "/chat",
  RAG: "/rag",
  DOCS: "/docs",
  SETTINGS: "/settings",
} as const;

/** 顶栏 Tab 配置：href 为 Next.js 页面路由（设置走右侧图标，不进 Tab） */
export const NAV_TABS: NavTab[] = [
  { key: "home", label: "HOME", href: APP_ROUTES.HOME },
  { key: "chat", label: "CHAT", href: APP_ROUTES.CHAT },
  { key: "rag", label: "RAG", href: APP_ROUTES.RAG },
  { key: "docs", label: "DOCS", href: APP_ROUTES.DOCS },
];

/** 根据当前 pathname 判断 Tab 是否激活 */
export function isNavTabActive(pathname: string, href: string): boolean {
  if (href === APP_ROUTES.HOME) return pathname === APP_ROUTES.HOME;
  return pathname === href || pathname.startsWith(`${href}/`);
}
