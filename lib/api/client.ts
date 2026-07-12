import type { ApiResponse } from "@/types/api";

/**
 * 浏览器端 fetch 封装
 * 约定：所有接口返回统一的 ApiResponse 结构，code !== 0 视为业务错误
 */
class ApiClient {
  async get<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = (await res.json()) as ApiResponse<T>;
    if (json.code !== 0) {
      throw new Error(json.message);
    }

    return json.data;
  }

  async post<T>(url: string, data: any): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = (await res.json()) as ApiResponse<T>;
    if (json.code !== 0) {
      throw new Error(json.message);
    }

    return json.data;
  }
}

export const apiClient = new ApiClient();
