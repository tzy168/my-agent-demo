"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DEEPSEEK_MODELS,
  DEEPSEEK_MODEL_LABELS,
  type DeepSeekModel,
} from "@/types/settings";

type ModelSelectProps = {
  value: DeepSeekModel;
  disabled?: boolean;
  onChange: (model: DeepSeekModel) => void;
};

type MenuPos = { left: number; bottom: number; width: number };

/** 可皮肤化模型选择；选项来自 DEEPSEEK_MODELS，加模型只改 catalog */
export function ModelSelect({ value, disabled, onChange }: ModelSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);

  // fixed 定位：避开 chat-panel overflow 裁切；宽度跟触发器一致
  const placeMenu = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: r.left,
      bottom: window.innerHeight - r.top + 6,
      width: r.width,
    });
  };

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", placeMenu);
    // 列表滚动时也重算，避免菜单悬空
    window.addEventListener("scroll", placeMenu, true);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // 同次更新打开 + 坐标，避免先闪空菜单
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: r.left,
      bottom: window.innerHeight - r.top + 6,
      width: r.width,
    });
    setOpen(true);
  };

  const select = (model: DeepSeekModel) => {
    onChange(model);
    setOpen(false);
  };

  return (
    <div className="chat-model-picker" ref={rootRef}>
      <button
        type="button"
        className="chat-model-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
      >
        {DEEPSEEK_MODEL_LABELS[value]}
      </button>
      {open && pos ? (
        <ul
          id={listId}
          className="chat-model-menu"
          role="listbox"
          aria-label="DeepSeek 模型"
          style={{
            left: pos.left,
            bottom: pos.bottom,
            width: pos.width,
          }}
        >
          {DEEPSEEK_MODELS.map((m) => (
            <li key={m} role="presentation">
              <button
                type="button"
                role="option"
                className="chat-model-option"
                aria-selected={m === value}
                onClick={() => select(m)}
              >
                {DEEPSEEK_MODEL_LABELS[m]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
