import {
  SystemMessage,
  HumanMessage,
  ToolMessage,
  type BaseMessage,
  type AIMessage,
} from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createChatModel, type ChatModelOptions } from "./model";
import { getNowTimeTool } from "./tools";

/** 当前 baseChat 绑定的工具；按 name 查找执行 */
const baseChatTools = [getNowTimeTool];
const baseChatToolsByName = Object.fromEntries(
  baseChatTools.map((t) => [t.name, t]),
);

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

/** 把最终文本包成 ReadableStream，兼容现有前端流式消费 */
function textToStream(text: string, signal?: AbortSignal) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      if (signal?.aborted) {
        controller.close();
        return;
      }
      if (text) controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

export const baseChat = async (
  msg: string,
  systemMsg: string,
  signal?: AbortSignal,
  modelOptions?: ChatModelOptions,
) => {
  try {
    const model = createChatModel(modelOptions).bindTools(baseChatTools);
    const messages: BaseMessage[] = [
      new SystemMessage(systemMsg),
      new HumanMessage(msg),
    ];

    // 工具闭环：决定调用 → 执行 → ToolMessage 回注 → 再生成（最多 3 轮）
    let aiMessage = (await model.invoke(messages, { signal })) as AIMessage;
    messages.push(aiMessage);

    for (let i = 0; i < 3 && aiMessage.tool_calls?.length; i++) {
      for (const call of aiMessage.tool_calls) {
        const selected = baseChatToolsByName[call.name];
        // 传完整 ToolCall，满足 StructuredTool 入参类型
        const result = selected
          ? await selected.invoke(call)
          : `未知工具: ${call.name}`;
        messages.push(
          new ToolMessage({
            content: typeof result === "string" ? result : JSON.stringify(result),
            tool_call_id: call.id ?? call.name,
          }),
        );
      }
      aiMessage = (await model.invoke(messages, { signal })) as AIMessage;
      messages.push(aiMessage);
    }

    return textToStream(toTextContent(aiMessage.content), signal);
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
