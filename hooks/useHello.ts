"use client";

import { useCallback, useState } from "react";

import { API_ROUTES } from "@/constants/api";
import { apiClient } from "@/lib/api";
import type { HelloData } from "@/types/api";

/** 调用 /api/hello 的简易 hook */
export function useHello() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HelloData | null>(null);

  const loadHello = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.get<HelloData>(API_ROUTES.HELLO);
      setData(result);
      return result;
    } catch (e) {
      // 兜底：非 Error 实例时给出通用提示
      const message = e instanceof Error ? e.message : "请求失败";
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, data, loadHello };
}
