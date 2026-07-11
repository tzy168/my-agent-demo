/** 统一 API 响应包装 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** /api/hello 响应 data 字段 */
export interface HelloData {
  message: string;
}
