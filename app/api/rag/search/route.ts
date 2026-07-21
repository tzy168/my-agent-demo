import { errorResponse, searchRag, successResponse } from "@/lib/server";

/**
 * POST { query: string, k?: number }
 * 返回带余弦相似度的检索结果
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const k = typeof body?.k === "number" ? body.k : 4;

    if (!query) {
      return errorResponse("query 不能为空", -1, 400);
    }

    const hits = await searchRag(query, k);
    return successResponse({ hits, query });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "检索失败";
    return errorResponse(message);
  }
}
