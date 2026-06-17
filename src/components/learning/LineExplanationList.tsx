"use client";

import { useState } from "react";
import type { AgentLineExplanation } from "@/lib/agent";
import type { CodeToken, ConceptOccurrence } from "@/lib/translator/types";

const DEFAULT_VISIBLE = 5;

interface LineExplanationListProps {
  lineExplanations: AgentLineExplanation[];
  tokens?: CodeToken[];
  onTokenClick?: (tokenId: string, conceptId: string | undefined) => void;
  concepts?: ConceptOccurrence[];
  onConceptClick?: (conceptId: string) => void;
}

export default function LineExplanationList({
  lineExplanations,
  tokens = [],
  onTokenClick,
  concepts = [],
  onConceptClick,
}: LineExplanationListProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? lineExplanations : lineExplanations.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = lineExplanations.length - DEFAULT_VISIBLE;

  if (lineExplanations.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        줄 설명이 없다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleItems.map((item, i) => {
        const lineTokens = item.tokenIds
          .map((id) => tokens.find((t) => t.id === id))
          .filter((t): t is CodeToken => t !== undefined);

        const lineConcepts = item.conceptIds
          .map((id) => concepts.find((c) => c.conceptId === id))
          .filter((c): c is ConceptOccurrence => c !== undefined);

        return (
          <div
            key={`${i}-${item.line}`}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center rounded-lg bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                {item.line}번 줄
              </span>
              {item.confidence != null && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {Math.round(item.confidence * 100)}%
                </span>
              )}
            </div>
            <pre className="overflow-x-auto rounded-xl bg-white p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
              {item.code}
            </pre>
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
              {item.explanation}
            </p>
            {lineTokens.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lineTokens.map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    onClick={() => onTokenClick?.(token.id, token.conceptId)}
                    className="inline-flex items-center rounded-lg bg-zinc-200 px-2 py-0.5 text-xs font-mono font-medium text-zinc-700 transition hover:bg-blue-100 hover:text-blue-700 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
                  >
                    {token.token}
                  </button>
                ))}
              </div>
            )}
            {lineConcepts.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {lineConcepts.map((concept) => (
                  <button
                    key={concept.conceptId}
                    type="button"
                    onClick={() => onConceptClick?.(concept.conceptId)}
                    className="inline-flex items-center rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 transition hover:bg-violet-200 hover:text-violet-900 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-800/40 dark:hover:text-violet-200"
                  >
                    {concept.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          더 보기 ({hiddenCount}개 더)
        </button>
      )}
      {showAll && lineExplanations.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          접기
        </button>
      )}
    </div>
  );
}
