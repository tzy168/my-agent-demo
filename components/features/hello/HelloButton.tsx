"use client";

import { useHello } from "@/hooks/useHello";

export function HelloButton() {
  const { loading, loadHello } = useHello();

  async function handleClick() {
    try {
      const result = await loadHello();
      alert(result.message);
    } catch {
      alert("请求失败");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
    >
      {loading ? "Loading..." : "Call API"}
    </button>
  );
}
