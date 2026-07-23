import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type LlmProvider,
} from "@/types/settings";

const SETTINGS_KEY = "th-settings";

function isProvider(value: unknown): value is LlmProvider {
  return value === "ollama" || value === "deepseek";
}

/** 读取本地设置；SSR / 不可用时返回默认值 */
export function readSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      provider: isProvider(parsed.provider)
        ? parsed.provider
        : DEFAULT_SETTINGS.provider,
      deepseekApiKey:
        typeof parsed.deepseekApiKey === "string"
          ? parsed.deepseekApiKey
          : "",
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 写入本地设置 */
export function writeSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * 组装聊天请求里的模型参数（provider + 可选 apiKey）
 * Chat / RAG Chat 共用，避免两处各写一遍
 */
export function chatModelPayload() {
  const { provider, deepseekApiKey } = readSettings();
  return {
    provider,
    // 仅 DeepSeek 时带上 key；Ollama 不需要
    apiKey: provider === "deepseek" ? deepseekApiKey : undefined,
  };
}
