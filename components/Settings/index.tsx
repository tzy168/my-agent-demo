"use client";

import { useEffect, useId, useState } from "react";
import { applyColorPalette, readSettings, writeSettings } from "@/lib/settings";
import {
  COLOR_PALETTE_META,
  COLOR_PALETTES,
  type AppSettings,
  type ColorPalette,
  type LlmProvider,
} from "@/types/settings";

/** /settings：色板 + 模型提供方 + DeepSeek API Key */
export function Settings() {
  const formId = useId();
  const providerOllamaId = `${formId}-ollama`;
  const providerDeepseekId = `${formId}-deepseek`;
  const apiKeyId = `${formId}-apikey`;

  const [provider, setProvider] = useState<LlmProvider>("ollama");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [colorPalette, setColorPalette] = useState<ColorPalette>("editorial");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = readSettings();
    setProvider(s.provider);
    setDeepseekApiKey(s.deepseekApiKey);
    setColorPalette(s.colorPalette);
    applyColorPalette(s.colorPalette);
  }, []);

  const handlePaletteChange = (next: ColorPalette) => {
    setColorPalette(next);
    // 色板即时生效并落盘（与顶栏 light/dark 一致），勿等「保存设置」
    writeSettings({ ...readSettings(), colorPalette: next });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // 保留 Chat 页已选的 deepseekModel，避免设置页覆盖
    const prev = readSettings();
    const next: AppSettings = {
      provider,
      deepseekApiKey: deepseekApiKey.trim(),
      deepseekModel: prev.deepseekModel,
      colorPalette,
    };
    // DeepSeek 必须有 Key，否则保存时提示原生校验
    if (provider === "deepseek" && !next.deepseekApiKey) {
      const input = document.getElementById(apiKeyId) as HTMLInputElement | null;
      input?.setCustomValidity("使用 DeepSeek 时请填写 API Key");
      input?.reportValidity();
      return;
    }
    writeSettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-panel">
      <header className="settings-header">
        <h1 className="settings-title">设置</h1>
        <p className="settings-desc">
          选择主题色板与聊天模型提供方。DeepSeek 走官方 API；Ollama 继续用本地模型。
        </p>
      </header>

      <form className="settings-form" onSubmit={handleSubmit} method="post">
        <fieldset className="settings-fieldset">
          <legend className="settings-legend">主题色板</legend>
          <div className="settings-radios">
            {COLOR_PALETTES.map((id) => {
              const meta = COLOR_PALETTE_META[id];
              const inputId = `${formId}-palette-${id}`;
              return (
                <label className="settings-radio" htmlFor={inputId} key={id}>
                  <input
                    id={inputId}
                    type="radio"
                    name="colorPalette"
                    value={id}
                    checked={colorPalette === id}
                    onChange={() => handlePaletteChange(id)}
                  />
                  <span className="settings-palette-body">
                    <span
                      className="settings-swatches"
                      aria-hidden="true"
                    >
                      {meta.swatches.map((hex) => (
                        <span
                          key={hex}
                          className="settings-swatch"
                          style={{ background: hex }}
                        />
                      ))}
                    </span>
                    <span>
                      <span className="settings-radio-label">{meta.label}</span>
                      <span className="settings-radio-hint">{meta.hint}</span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend className="settings-legend">模型提供方</legend>
          <div className="settings-radios">
            <label className="settings-radio" htmlFor={providerOllamaId}>
              <input
                id={providerOllamaId}
                type="radio"
                name="provider"
                value="ollama"
                checked={provider === "ollama"}
                onChange={() => setProvider("ollama")}
              />
              <span>
                <span className="settings-radio-label">Ollama</span>
                <span className="settings-radio-hint">本地模型，无需 API Key</span>
              </span>
            </label>
            <label className="settings-radio" htmlFor={providerDeepseekId}>
              <input
                id={providerDeepseekId}
                type="radio"
                name="provider"
                value="deepseek"
                checked={provider === "deepseek"}
                onChange={() => setProvider("deepseek")}
              />
              <span>
                <span className="settings-radio-label">DeepSeek</span>
                <span className="settings-radio-hint">云端 API，需填写 Key</span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="settings-field">
          <label className="settings-label" htmlFor={apiKeyId}>
            DeepSeek API Key
            {provider === "deepseek" ? (
              <span className="settings-required">（必填）</span>
            ) : null}
          </label>
          <div className="settings-key-row">
            <input
              id={apiKeyId}
              name="deepseekApiKey"
              type={showKey ? "text" : "password"}
              className="settings-input"
              value={deepseekApiKey}
              onChange={(e) => {
                e.currentTarget.setCustomValidity("");
                setDeepseekApiKey(e.target.value);
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-..."
              disabled={provider !== "deepseek"}
              required={provider === "deepseek"}
              enterKeyHint="done"
            />
            <button
              type="button"
              className="settings-toggle-key"
              onClick={() => setShowKey((v) => !v)}
              disabled={provider !== "deepseek"}
              aria-pressed={showKey}
            >
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
          <p className="settings-hint" id={`${apiKeyId}-hint`}>
            Key 仅保存在本机 localStorage，请求时发给本服务端再转发 DeepSeek。也可在服务端配置环境变量{" "}
            <code>DEEPSEEK_API_KEY</code> 作为兜底。
          </p>
        </div>

        <div className="settings-actions">
          <button type="submit" className="btn-primary">
            保存设置
          </button>
          {saved ? (
            <span className="settings-saved" role="status" aria-live="polite">
              已保存
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export default Settings;
