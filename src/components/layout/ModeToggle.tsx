"use client";

import type { AnalyzeMode } from "@/lib/agent";

interface ModeToggleProps {
  mode: AnalyzeMode;
  onModeChange: (mode: AnalyzeMode) => void;
  disabled?: boolean;
}

const MODE_OPTIONS: { value: AnalyzeMode; label: string }[] = [
  { value: "code", label: "코드 분석" },
  { value: "text", label: "글 분석" },
];

// 헤더 정중앙 — 코드/글 분석 모드 토글. (히스토리·북마크는 모드별 분리, Issue 76.)
export default function ModeToggle({ mode, onModeChange, disabled = false }: ModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="분석 모드"
      className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {MODE_OPTIONS.map((opt) => {
        const selected = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onModeChange(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
