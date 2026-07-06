import { API_ROUTES } from "@/constants/api.routes";
import { apiClient } from "@/lib/api/client";
import type { HelloData } from "@/types/api/hello.types";

/** 请求 Hello 接口 */
export async function fetchHello(): Promise<HelloData> {
  return apiClient.get<HelloData>(API_ROUTES.HELLO);
}
