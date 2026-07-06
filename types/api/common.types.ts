/** 统一 API 响应包装 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}
