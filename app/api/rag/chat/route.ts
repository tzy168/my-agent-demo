import { errorResponse, streamRagChat } from "@/lib/server";

/**
 * POST { msg: string }
 * 成功：纯文本流；响应头 X-Rag-Hits 为检索结果 JSON（含相似度）
 */
export async function POST(request: Request) {
  try {
    const { msg } = await request.json();
    if (typeof msg !== "string" || !msg.trim()) {
      return errorResponse("msg 不能为空", -1, 400);
    }

    const { stream, hits } = await streamRagChat(msg.trim(), request.signal);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        // 前端读取检索命中（含相似度）；中文文件名需 encode
        "X-Rag-Hits": encodeURIComponent(JSON.stringify(hits)),
        "Access-Control-Expose-Headers": "X-Rag-Hits",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "RAG 对话失败";
    return errorResponse(message);
  }
}
