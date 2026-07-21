import { errorResponse, getRagStatus, successResponse } from "@/lib/server";

/** GET 知识库状态：chunk 数与来源文件列表 */
export async function GET() {
  try {
    return successResponse(getRagStatus());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取状态失败";
    return errorResponse(message);
  }
}
