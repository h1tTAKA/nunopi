"use client";

import { useState } from "react";
import type { HistoryEntry } from "@/lib/historyDB";

interface AnalysisHistoryProps {
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onUpdate?: (id: string, changes: Partial<Pick<HistoryEntry, "isPinned" | "title">>) => void;
  alwaysOpen?: boolean;
}

export default function AnalysisHistory({
  entries,
  onRestore,
  onDelete,
  onClear,
  onUpdate,
  alwaysOpen = false,
}: AnalysisHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const effectiveOpen = alwaysOpen || isOpen;

  if (!alwaysOpen && entries.length === 0) return null;

  const codePreview = (code: string) => {
    const firstLine = code.trim().split(/\r?\n/)[0] ?? "";
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
  };

  const filteredEntries = query.trim()
    ? entries.filter(
        (e) =>
          (e.title ?? codePreview(e.code)).toLowerCase().includes(query.toLowerCase()) ||
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

  function startEditing(entry: HistoryEntry) {
    setEditingId(entry.id);
    setDraftTitle(entry.title ?? "");
  }

  function saveTitle(id: string) {
    if (editingId !== id) return;
    setEditingId(null);
    const trimmed = draftTitle.trim();
    onUpdate?.(id, { title: trimmed || undefined });
  }

  const listContent = (
    <div className="space-y-1.5">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="제목 또는 provider 검색…"
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-600"
      />
      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
          분석 히스토리가 없다.
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className="py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
          검색 결과가 없다.
        </p>
      ) : (
        <div className={`${alwaysOpen ? "" : "max-h-48"} overflow-y-auto space-y-1.5`}>
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-xl border px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900 ${
                entry.isPinned
                  ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20"
                  : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {/* 핀 버튼 */}
                {onUpdate && (
                  <button
                    type="button"
                    onClick={() => onUpdate(entry.id, { isPinned: !entry.isPinned })}
                    className={`shrink-0 text-sm leading-none transition ${
                      entry.isPinned
                        ? "text-amber-500 dark:text-amber-400"
                        : "text-zinc-300 hover:text-amber-400 dark:text-zinc-600 dark:hover:text-amber-500"
                    }`}
                    title={entry.isPinned ? "핀 해제" : "핀 고정"}
                    aria-label={entry.isPinned ? "핀 해제" : "핀 고정"}
                  >
                    📌
                  </button>
                )}

                {/* 메인 복원 버튼 */}
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  className="flex-1 min-w-0 text-left"
                  aria-label={`히스토리 복원: ${entry.title ?? codePreview(entry.code)}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center rounded bg-zinc-200 px-1 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 shrink-0">
                      {entry.providerId}
                    </span>
                    <span className="truncate text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                      {dateLabel(entry.createdAt)}
                    </span>
                  </div>
                </button>

                {/* 삭제 버튼 */}
                <button
                  type="button"
                  onClick={() => onDelete(entry.id)}
                  className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  aria-label="히스토리 항목 삭제"
                >
                  ×
                </button>
              </div>

              {/* 제목 / 코드 미리보기 — 인라인 편집 */}
              <div className="mt-1.5 pl-0">
                {editingId === entry.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => saveTitle(entry.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); saveTitle(entry.id); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    placeholder="제목 입력…"
                    className="w-full rounded-lg border border-blue-300 bg-white px-2 py-0.5 text-xs text-zinc-700 outline-none dark:border-blue-600 dark:bg-zinc-900 dark:text-zinc-200"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(entry)}
                    className="w-full text-left truncate text-xs font-mono text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                    title="클릭하여 제목 편집"
                  >
                    {entry.title || codePreview(entry.code)}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (alwaysOpen) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {entries.length > 0 ? `총 ${entries.length}개` : ""}
          </span>
          {entries.length > 0 && (
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
        {listContent}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setIsOpen((v) => !v); setQuery(""); }}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {effectiveOpen ? "▲" : "▼"} 히스토리 {effectiveOpen && query.trim() ? `${filteredEntries.length}/${entries.length}` : entries.length}개
        </button>
        {effectiveOpen && (
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

      {effectiveOpen && listContent}
    </div>
  );
}
