import {
  COLOR_PALETTES,
  DEFAULT_SETTINGS,
  DEEPSEEK_MODELS,
  type AppSettings,
  type ColorPalette,
  type DeepSeekModel,
  type LlmProvider,
} from "@/types/settings";

const SETTINGS_KEY = "th-settings";
/** 同页监听设置变更（storage 事件跨 tab 才触发） */
export const SETTINGS_EVENT = "th-settings";

function isProvider(value: unknown): value is LlmProvider {
  return value === "ollama" || value === "deepseek";
}

function isDeepSeekModel(value: unknown): value is DeepSeekModel {
  return (
    typeof value === "string" &&
    (DEEPSEEK_MODELS as readonly string[]).includes(value)
  );
}

function isColorPalette(value: unknown): value is ColorPalette {
  return (
    typeof value === "string" &&
    (COLOR_PALETTES as readonly string[]).includes(value)
  );
}

/** 把色板写到 <html data-palette>，供 tokens.css 切换 */
export function applyColorPalette(palette: ColorPalette): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-palette", palette);
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
      deepseekModel: isDeepSeekModel(parsed.deepseekModel)
        ? parsed.deepseekModel
        : DEFAULT_SETTINGS.deepseekModel,
      colorPalette: isColorPalette(parsed.colorPalette)
        ? parsed.colorPalette
        : DEFAULT_SETTINGS.colorPalette,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 写入本地设置，并通知同页订阅者 */
export function writeSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applyColorPalette(settings.colorPalette);
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

/**
 * 组装聊天请求里的模型参数（provider + 可选 apiKey / model）
 * Chat / RAG Chat 共用，避免两处各写一遍
 */
export function chatModelPayload() {
  const { provider, deepseekApiKey, deepseekModel } = readSettings();
  return {
    provider,
    // 仅 DeepSeek 时带上 key / model；Ollama 不需要
    apiKey: provider === "deepseek" ? deepseekApiKey : undefined,
    model: provider === "deepseek" ? deepseekModel : undefined,
  };
}
