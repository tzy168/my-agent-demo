import { NavTabs } from "@/components";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-shell">
      <NavTabs>{children}</NavTabs>
    </div>
  );
}
