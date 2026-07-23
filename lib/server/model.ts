import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { modelConfig } from "@/config";
import type { LlmProvider } from "@/types/settings";

export type ChatModelOptions = {
  provider?: LlmProvider;
  /** DeepSeek 时必填（或走环境变量 DEEPSEEK_API_KEY） */
  apiKey?: string;
};

/** 从请求体解析模型参数；非法值忽略，回退默认 Ollama */
export function parseModelOptions(body: {
  provider?: unknown;
  apiKey?: unknown;
}): ChatModelOptions {
  const provider =
    body.provider === "ollama" || body.provider === "deepseek"
      ? (body.provider as LlmProvider)
      : undefined;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
  return { provider, apiKey };
}

/** 按 provider 创建聊天模型；embedding 仍固定走 Ollama */
export function createChatModel(options: ChatModelOptions = {}) {
  const provider = options.provider ?? "ollama";

  if (provider === "deepseek") {
    const apiKey =
      options.apiKey?.trim() || modelConfig.deepseek.apiKey.trim();
    if (!apiKey) {
      throw new Error("未配置 DeepSeek API Key，请到设置页填写或配置环境变量 DEEPSEEK_API_KEY");
    }

    return new ChatOpenAI({
      model: modelConfig.deepseek.chatModel,
      apiKey,
      configuration: {
        baseURL: modelConfig.deepseek.baseUrl,
      },
      temperature: Number(modelConfig.deepseek.temperature),
    });
  }

  return new ChatOllama({
    model: modelConfig.ollama.chatModel,
    baseUrl: modelConfig.ollama.host,
    temperature: Number(modelConfig.ollama.temperature),
    think: false,
  });
}
