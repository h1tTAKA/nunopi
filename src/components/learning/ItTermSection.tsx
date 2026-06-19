"use client";

import type { ItTerm } from "@/lib/translator/types";

interface ItTermSectionProps {
  terms: ItTerm[];
  activeTermId?: string | null;
  // 용어 클릭 시 관련 개념으로 이동(관련 개념 id들을 전달).
  onTermClick?: (conceptIds: string[]) => void;
}

// 글 모드 IT 용어 사전 — 코드 모드 TokenSection에 대응. 글에서 뽑은 IT 용어를
// 초보자용 설명과 함께 카드로 보여준다.
export default function ItTermSection({ terms, activeTermId, onTermClick }: ItTermSectionProps) {
  if (terms.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        추출된 IT 용어가 없다.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {terms.map((term) => {
        const isActive = activeTermId === term.id;
        const hasConcepts = term.conceptIds.length > 0;
        return (
          <button
            key={term.id}
            type="button"
            onClick={() => onTermClick?.(term.conceptIds)}
            aria-label={`${term.term} 용어`}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              isActive
                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
                {term.term}
              </code>
              {term.reading && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{term.reading}</span>
              )}
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{term.explanation}</p>
            {hasConcepts && (
              <p className="mt-2 text-xs text-blue-500 dark:text-blue-400">
                관련 개념 {term.conceptIds.length}개 →
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
