"use client";

import { useState } from "react";
import type { BookmarkedConceptDetail } from "@/lib/bookmarkDetails";
import { StarIcon } from "./icons";

interface ConceptDictionaryProps {
  details: Record<string, BookmarkedConceptDetail>;
  onUnbookmark: (title: string) => void;
}

type SortMode = "latest" | "oldest" | "alpha";

const SORT_LABELS: Record<SortMode, string> = { latest: "최신순", oldest: "과거순", alpha: "가나다순" };

// 북마크한 개념 사전 — title + 설명(드래그 복사 가능) + ★ 해제.
export default function ConceptDictionary({ details, onUnbookmark }: ConceptDictionaryProps) {
  const [sortMode, setSortMode] = useState<SortMode>("latest");

  const entries = Object.values(details);

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
        북마크한 개념이 없다.<br />
        <span className="text-xs">개념 카드의 ★ 버튼으로 북마크할 수 있다.</span>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    if (sortMode === "latest") return new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime();
    if (sortMode === "oldest") return new Date(a.bookmarkedAt).getTime() - new Date(b.bookmarkedAt).getTime();
    return a.title.localeCompare(b.title, "ko");
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
        {sorted.map((concept) => (
          <div
            key={concept.title}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{concept.title}</p>
                {concept.description && (
                  <p className="mt-1 select-text text-xs text-zinc-600 dark:text-zinc-300">
                    {concept.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onUnbookmark(concept.title)}
                className="shrink-0 text-lime-600 transition hover:text-zinc-400 dark:text-lime-400 dark:hover:text-zinc-500"
                title="북마크 해제"
                aria-label={`${concept.title} 북마크 해제`}
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
