/** 聊天模型提供方 */
export type LlmProvider = "ollama" | "deepseek";

/** 前端设置（localStorage 持久化） */
export type AppSettings = {
  provider: LlmProvider;
  /** DeepSeek API Key；选 Ollama 时可为空 */
  deepseekApiKey: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "ollama",
  deepseekApiKey: "",
};
