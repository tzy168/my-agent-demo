import { ChatOllama } from "@langchain/ollama";
import { modelConfig } from "@/config";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

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

export const baseChat = async (
  msg: string,
  systemMsg: string,
  signal?: AbortSignal,
) => {
  try {
    // const result = await model.invoke([
    //   new SystemMessage(systemMessage),
    //   new HumanMessage(msg),
    // ]);
    // return toTextContent(result.content);

    // 最简单流式：把模型 chunk 文本直接推进 ReadableStream
    const stream = await model.stream([
      new SystemMessage(systemMsg),
      new HumanMessage(msg),
    ]);
    const encoder = new TextEncoder();

    // ReadableStream：流式响应，用于前端消费
    return new ReadableStream({
      async start(controller) {
        const onAbort = () => controller.close();
        signal?.addEventListener("abort", onAbort);

        try {
          for await (const chunk of stream) {
            if (signal?.aborted) break;
            const text = toTextContent(chunk.content);
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (error) {
          if (!signal?.aborted) controller.error(error);
        } finally {
          signal?.removeEventListener("abort", onAbort);
        }
      },
    });
  } catch (error) {
    console.error(error);
    // 勿直接 return error：前端 String(Error) 会变成 [object Object]
    throw error instanceof Error ? error : new Error(String(error));
  }
};

/**
 * 
 * @param msg 用户的问题
 * @returns 流式响应
 */
export const streamWithPipe = async (
  msg: string,
  systemMsg: string,
) => {
  try {
    const chain = ChatPromptTemplate.fromMessages([
      new SystemMessage(
        '你是一个资深的程序员技术大佬，擅长将零碎、复杂的知识，体系化、简单化，并给出快速入门的建议。',
      ),
      new HumanMessage(msg),
    ]).pipe(model).pipe(new StringOutputParser());

    const stream = await chain.stream({ msg });
    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  } catch (error) {
    console.error(error);
    throw error instanceof Error ? error : new Error(String(error));
  }
};