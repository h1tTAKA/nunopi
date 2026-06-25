"use client";

import { IconCode, IconFileText } from "@tabler/icons-react";
import type { AnalyzeMode } from "@/lib/agent";
import { useT } from "@/lib/i18n/I18nProvider";

interface ModeToggleProps {
  mode: AnalyzeMode;
  onModeChange: (mode: AnalyzeMode) => void;
  disabled?: boolean;
}

const MODE_OPTIONS: { value: AnalyzeMode; tKey: string; Icon: typeof IconCode }[] = [
  { value: "code", tKey: "mode.code", Icon: IconCode },
  { value: "text", tKey: "mode.text", Icon: IconFileText },
];

// 헤더 정중앙 — 코드/글 분석 모드 토글. (히스토리·북마크는 모드별 분리, Issue 76.)
export default function ModeToggle({ mode, onModeChange, disabled = false }: ModeToggleProps) {
  const t = useT();
  return (
    <div
      role="tablist"
      aria-label="분석 모드"
      className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {MODE_OPTIONS.map((opt) => {
        const selected = mode === opt.value;
        const { Icon } = opt;
        const label = t(opt.tKey);
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onModeChange(opt.value)}
            className={`flex items-center justify-center rounded-lg px-7 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Icon size={18} stroke={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
