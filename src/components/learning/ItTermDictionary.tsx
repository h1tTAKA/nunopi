"use client";

import { useState } from "react";
import type { BookmarkedTermDetail } from "@/lib/bookmarkDetails";
import { StarIcon } from "./icons";

interface ItTermDictionaryProps {
  details: Record<string, BookmarkedTermDetail>;
  onUnbookmark: (termText: string) => void;
}

type SortMode = "latest" | "oldest" | "alpha";

const SORT_LABELS: Record<SortMode, string> = { latest: "최신순", oldest: "과거순", alpha: "가나다순" };

// 글 모드 IT 용어 북마크 사전 — 코드 모드 TokenDictionary에 대응(카테고리 없이 플랫).
export default function ItTermDictionary({ details, onUnbookmark }: ItTermDictionaryProps) {
  const [sortMode, setSortMode] = useState<SortMode>("latest");

  const entries = Object.values(details);

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
        북마크한 IT 용어가 없다.<br />
        <span className="text-xs">용어 카드의 ★ 버튼으로 북마크할 수 있다.</span>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    if (sortMode === "latest") return new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime();
    if (sortMode === "oldest") return new Date(a.bookmarkedAt).getTime() - new Date(b.bookmarkedAt).getTime();
    return a.term.localeCompare(b.term, "ko");
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {(["latest", "oldest", "alpha"] as SortMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setSortMode(m)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              sortMode === m
                ? "bg-zinc-800 text-zinc-50 dark:bg-zinc-200 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {SORT_LABELS[m]}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">{entries.length}개</span>
      </div>

      <div className="space-y-1.5">
        {sorted.map((term) => (
          <div
            key={term.term}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
                    {term.term}
                  </code>
                  {term.reading && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{term.reading}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{term.explanation}</p>
              </div>
              <button
                type="button"
                onClick={() => onUnbookmark(term.term)}
                className="shrink-0 text-lime-600 transition hover:text-zinc-400 dark:text-lime-400 dark:hover:text-zinc-500"
                title="북마크 해제"
                aria-label={`${term.term} 북마크 해제`}
              >
                <StarIcon filled />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
