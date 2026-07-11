import type { ApiResponse } from "@/types/api";

/** 构造统一成功响应 */
export function successResponse<T>(data: T, message = "success"): Response {
  const body: ApiResponse<T> = { code: 0, message, data };
  return Response.json(body);
}

/** 构造统一错误响应 */
export function errorResponse(message: string, code = -1, status = 500): Response {
  const body: ApiResponse = { code, message, data: null };
  return Response.json(body, { status });
}
