"use client";

import { useEffect } from "react";
import type { ItConcept } from "@/lib/translator/types";
import { StarIcon } from "./icons";

interface ItConceptSectionProps {
  concepts: ItConcept[];
  activeConceptId?: string | null;
  // 북마크 — 누르면 IT 용어 사전에 저장(용어와 한 사전). title 기준.
  onBookmarkToggle?: (concept: ItConcept) => void;
  bookmarkedTitles?: string[];
}

// 글 모드 관련 개념 — 코드 모드 ConceptSection에 대응. 용어 설명에 더 필요한
// 배경 개념을 항상 설명과 함께 카드로 보여준다(코드 모드와 달리 설명이 동적).
export default function ItConceptSection({
  concepts,
  activeConceptId,
  onBookmarkToggle,
  bookmarkedTitles = [],
}: ItConceptSectionProps) {
  useEffect(() => {
    if (!activeConceptId) return;
    const el = document.getElementById(`it-concept-${activeConceptId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeConceptId]);

  if (concepts.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        관련 개념이 없다.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {concepts.map((concept) => {
        const isActive = activeConceptId === concept.conceptId;
        return (
          <div
            key={concept.conceptId}
            id={`it-concept-${concept.conceptId}`}
            className={`scroll-mt-4 rounded-2xl border p-4 transition ${
              isActive
                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{concept.title}</p>
              {onBookmarkToggle && (
                <button
                  type="button"
                  onClick={() => onBookmarkToggle(concept)}
                  className={`shrink-0 transition ${
                    bookmarkedTitles.includes(concept.title)
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-zinc-400 hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400"
                  }`}
                  title={bookmarkedTitles.includes(concept.title) ? "북마크 해제" : "IT 용어 사전에 북마크"}
                  aria-label={
                    bookmarkedTitles.includes(concept.title)
                      ? `${concept.title} 북마크 해제`
                      : `${concept.title} 북마크 추가`
                  }
                >
                  <StarIcon filled={bookmarkedTitles.includes(concept.title)} />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">{concept.explanation}</p>
          </div>
        );
      })}
    </div>
  );
}
