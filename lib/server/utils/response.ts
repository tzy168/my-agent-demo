import type { ApiResponse } from "@/types/api/common.types";

/** 构造统一成功响应 */
export function successResponse<T>(data: T, message = "success"): Response {
  const body: ApiResponse<T> = { code: 0, message, data };
  return Response.json(body);
}
