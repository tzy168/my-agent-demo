import { baseChat, errorResponse, parseModelOptions } from "@/lib/server";

/**
 *
 * @param request 请求体
 * @body {
 *  msg: string
 *  systemMsg: string
 *  provider?: "ollama" | "deepseek"
 *  apiKey?: string
 * }
 * @returns 纯文本流式响应
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { msg, systemMsg } = body;
    const stream = await baseChat(
      msg,
      systemMsg,
      request.signal,
      parseModelOptions(body),
    );
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "聊天请求失败";
    return errorResponse(message);
  }
}
