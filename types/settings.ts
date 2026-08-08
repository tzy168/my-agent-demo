/** 聊天模型提供方 */
export type LlmProvider = "ollama" | "deepseek";

/** DeepSeek 可选聊天模型 */
export type DeepSeekModel = "deepseek-v4-pro" | "deepseek-v4-flash";

/** 全站色板（与 light/dark 的 data-theme 正交，挂 data-palette） */
export type ColorPalette = "editorial" | "mono" | "verdant";

export const DEEPSEEK_MODELS: readonly DeepSeekModel[] = [
  "deepseek-v4-pro",
  "deepseek-v4-flash",
] as const;

export const COLOR_PALETTES: readonly ColorPalette[] = [
  "editorial",
  "mono",
  "verdant",
] as const;

/** 工具栏 select 短标；value 仍用完整 model id */
export const DEEPSEEK_MODEL_LABELS: Record<DeepSeekModel, string> = {
  "deepseek-v4-flash": "Flash",
  "deepseek-v4-pro": "Pro",
};

/** 设置页文案 + Home Grainient / 预览色点共用 */
export const COLOR_PALETTE_META: Record<
  ColorPalette,
  { label: string; hint: string; swatches: readonly [string, string, string] }
> = {
  editorial: {
    label: "暖纸赭红",
    hint: "当前编辑型极简：暖米纸底 + 赭红强调",
    swatches: ["#F6F3EC", "#1C1814", "#B0431B"],
  },
  mono: {
    label: "冷灰单色",
    hint: "以 #FFFFFF / #999999 / #111111 为主",
    swatches: ["#FFFFFF", "#999999", "#111111"],
  },
  verdant: {
    label: "墨玉黑绿",
    hint: "高级黑绿色系：深墨底 + 苔绿强调",
    swatches: ["#0B1410", "#1A3D32", "#6FBF9A"],
  },
};

/** 前端设置（localStorage 持久化） */
export type AppSettings = {
  provider: LlmProvider;
  /** DeepSeek API Key；选 Ollama 时可为空 */
  deepseekApiKey: string;
  /** DeepSeek 聊天模型；仅 provider=deepseek 时生效 */
  deepseekModel: DeepSeekModel;
  /** 全站色板；默认暖纸赭红 */
  colorPalette: ColorPalette;
};

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "ollama",
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-flash",
  colorPalette: "editorial",
};
