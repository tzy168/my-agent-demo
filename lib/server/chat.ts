import { ChatOllama } from "@langchain/ollama";
import { modelConfig } from "@/config";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const model = new ChatOllama({
  model: modelConfig.ollama.chatModel,
  baseUrl: modelConfig.ollama.host,
  temperature: Number(modelConfig.ollama.temperature),
  think: false,
});

/** LangChain content 可能是 string 或 ContentBlock[]，统一抽成纯文本 */
function toTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (
          block &&
          typeof block === "object" &&
          "text" in block &&
          typeof (block as { text: unknown }).text === "string"
        ) {
          return (block as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

export const baseChat = async (msg: string, systemMessage: string) => {
  try {
    // const result = await model.invoke([
    //   new SystemMessage(systemMessage),
    //   new HumanMessage(msg),
    // ]);
    // return toTextContent(result.content);

    // 最简单流式：把模型 chunk 文本直接推进 ReadableStream
    const stream = await model.stream([
      new SystemMessage(systemMessage),
      new HumanMessage(msg),
    ]);
    const encoder = new TextEncoder();

    // ReadableStream：流式响应，用于前端消费
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = toTextContent(chunk.content);
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  } catch (error) {
    console.error(error);
    // 勿直接 return error：前端 String(Error) 会变成 [object Object]
    throw error instanceof Error ? error : new Error(String(error));
  }
};