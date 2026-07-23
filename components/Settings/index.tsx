"use client";

import { useEffect, useId, useState } from "react";
import { readSettings, writeSettings } from "@/lib/settings";
import type { AppSettings, LlmProvider } from "@/types/settings";

/** /settings：模型提供方 + DeepSeek API Key */
export function Settings() {
  const formId = useId();
  const providerOllamaId = `${formId}-ollama`;
  const providerDeepseekId = `${formId}-deepseek`;
  const apiKeyId = `${formId}-apikey`;

  const [provider, setProvider] = useState<LlmProvider>("ollama");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = readSettings();
    setProvider(s.provider);
    setDeepseekApiKey(s.deepseekApiKey);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: AppSettings = {
      provider,
      deepseekApiKey: deepseekApiKey.trim(),
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
          选择聊天模型提供方。DeepSeek 走官方 API；Ollama 继续用本地模型。
        </p>
      </header>

      <form className="settings-form" onSubmit={handleSubmit} method="post">
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
