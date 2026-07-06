import type { ApiResponse } from "@/types/api/common.types";

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
}

export const apiClient = new ApiClient();
