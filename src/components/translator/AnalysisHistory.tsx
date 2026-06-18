"use client";

import { useState } from "react";
import type { HistoryEntry } from "@/lib/historyDB";

interface AnalysisHistoryProps {
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export default function AnalysisHistory({
  entries,
  onRestore,
  onDelete,
  onClear,
}: AnalysisHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (entries.length === 0) return null;

  const codePreview = (code: string) => {
    const firstLine = code.trim().split(/\r?\n/)[0] ?? "";
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
  };

  const dateLabel = (createdAt: string): string => {
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
    const timeStr = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    if (d >= todayStart) return timeStr;
    if (d >= yesterdayStart) return `어제 ${timeStr}`;
    return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {isOpen ? "▲" : "▼"} 히스토리 {entries.length}개
        </button>
        {isOpen && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            aria-label="히스토리 전체 삭제"
          >
            모두 삭제
          </button>
        )}
      </div>

      {isOpen && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => onRestore(entry)}
                className="flex-1 min-w-0 text-left"
                aria-label={`${entry.providerId} 분석 히스토리 복원: ${codePreview(entry.code)}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex items-center rounded bg-zinc-200 px-1 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 shrink-0">
                    {entry.providerId}
                  </span>
                  <span className="truncate text-xs text-zinc-700 dark:text-zinc-200 font-mono">
                    {codePreview(entry.code)}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                    {dateLabel(entry.createdAt)}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                aria-label="히스토리 항목 삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
