/** 聊天模型提供方 */
export type LlmProvider = "ollama" | "deepseek";

/** DeepSeek 可选聊天模型 */
export type DeepSeekModel = "deepseek-v4-pro" | "deepseek-v4-flash";

export const DEEPSEEK_MODELS: readonly DeepSeekModel[] = [
  "deepseek-v4-pro",
  "deepseek-v4-flash",
] as const;

/** 工具栏 select 短标；value 仍用完整 model id */
export const DEEPSEEK_MODEL_LABELS: Record<DeepSeekModel, string> = {
  "deepseek-v4-flash": "Flash",
  "deepseek-v4-pro": "Pro",
};

/** 前端设置（localStorage 持久化） */
export type AppSettings = {
  provider: LlmProvider;
  /** DeepSeek API Key；选 Ollama 时可为空 */
  deepseekApiKey: string;
  /** DeepSeek 聊天模型；仅 provider=deepseek 时生效 */
  deepseekModel: DeepSeekModel;
};

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "ollama",
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-flash",
};
