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
  const [query, setQuery] = useState("");

  if (entries.length === 0) return null;

  const codePreview = (code: string) => {
    const firstLine = code.trim().split(/\r?\n/)[0] ?? "";
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
  };

  const filteredEntries = query.trim()
    ? entries.filter(
        (e) =>
          codePreview(e.code).toLowerCase().includes(query.toLowerCase()) ||
          e.providerId.toLowerCase().includes(query.toLowerCase()),
      )
    : entries;

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
          onClick={() => { setIsOpen((v) => !v); setQuery(""); }}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {isOpen ? "▲" : "▼"} 히스토리 {isOpen && query.trim() ? `${filteredEntries.length}/${entries.length}` : entries.length}개
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
        <div className="space-y-1.5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="코드 또는 provider 검색…"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-600"
          />
          {filteredEntries.length === 0 ? (
            <p className="py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
              검색 결과가 없다.
            </p>
          ) : (
          <div className="max-h-48 overflow-y-auto space-y-1.5">
          {filteredEntries.map((entry) => (
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
      )}
    </div>
  );
}
