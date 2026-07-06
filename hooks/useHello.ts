"use client";

import { useCallback, useState } from "react";

import { fetchHello } from "@/services/hello.service";
import type { HelloData } from "@/types/api/hello.types";

export function useHello() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HelloData | null>(null);

  const loadHello = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchHello();
      setData(result);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : "请求失败";
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, data, loadHello };
}
