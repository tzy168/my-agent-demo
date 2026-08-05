import {
  SystemMessage,
  HumanMessage,
  ToolMessage,
  type AIMessageChunk,
  type BaseMessage,
} from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createChatModel, type ChatModelOptions } from "./model";
import { getNowTimeTool, webSearchTool } from "./tools";

/** 当前 baseChat 绑定的工具；标成公共基类型，避免异构 schema 的 invoke 签名联合 */
const baseChatTools: StructuredToolInterface[] = [
  getNowTimeTool,
  webSearchTool,
];
const baseChatToolsByName: Record<string, StructuredToolInterface> =
  Object.fromEntries(baseChatTools.map((t) => [t.name, t]));

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

/**
 * baseChat：真流式输出 + 工具闭环（最多 3 轮 tool call）
 * 以前用 invoke 整段生成再一次性塞进 Stream，DeepSeek/Ollama 都会「憋完再喷」
 */
export const baseChat = async (
  msg: string,
  systemMsg: string,
  webSearch: boolean,
  signal?: AbortSignal,
  modelOptions?: ChatModelOptions,
) => {
  const tools = webSearch ? baseChatTools : baseChatTools.filter((t) => t.name !== "web_search");
  const model = createChatModel(modelOptions).bindTools(tools);
  const messages: BaseMessage[] = [
    new SystemMessage(systemMsg),
    new HumanMessage(msg),
  ];
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const onAbort = () => controller.close();
      signal?.addEventListener("abort", onAbort);
      try {
        // 首轮回答 + 最多 3 次工具后再生成
        for (let round = 0; round < 4; round++) {
          if (signal?.aborted) break;

          const stream = await model.stream(messages, { signal });
          let gathered: AIMessageChunk | undefined;

          for await (const chunk of stream) {
            if (signal?.aborted) break;
            gathered = gathered ? gathered.concat(chunk) : chunk;
            const text = toTextContent(chunk.content);
            if (text) controller.enqueue(encoder.encode(text));
          }

          if (!gathered) break;
          messages.push(gathered);

          const toolCalls = gathered.tool_calls;
          if (!toolCalls?.length || round >= 3) break;

          for (const call of toolCalls) {
            const selected = baseChatToolsByName[call.name];
            // 传完整 ToolCall，满足 StructuredTool 入参类型
            const result = selected
              ? await selected.invoke(call)
              : `未知工具: ${call.name}`;
            messages.push(
              new ToolMessage({
                content:
                  typeof result === "string" ? result : JSON.stringify(result),
                tool_call_id: call.id ?? call.name,
              }),
            );
          }
        }
        controller.close();
      } catch (error) {
        console.error(error);
        if (!signal?.aborted) {
          // 勿直接 error(非 Error)：前端 String 会变成 [object Object]
          controller.error(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
    },
  });
};

/**
 *
 * @param msg 用户的问题
 * @returns 流式响应
 */
export const streamWithPipe = async (
  msg: string,
  systemMsg: string,
  modelOptions?: ChatModelOptions,
) => {
  try {
    const model = createChatModel(modelOptions);
    const chain = ChatPromptTemplate.fromMessages([
      new SystemMessage(
        "你是一个资深的程序员技术大佬，擅长将零碎、复杂的知识，体系化、简单化，并给出快速入门的建议。",
      ),
      new HumanMessage(msg),
    ])
      .pipe(model)
      .pipe(new StringOutputParser());

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
