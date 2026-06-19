"use client";

import { useEffect } from "react";
import type { ConceptOccurrence } from "@/lib/translator/types";
import { CONCEPT_DESCRIPTIONS } from "./conceptDescriptions";

const LEVEL_LABEL: Record<"beginner" | "intermediate", string> = {
  beginner: "초급",
  intermediate: "중급",
};

interface ConceptSectionProps {
  concepts: ConceptOccurrence[];
  activeConceptId?: string | null;
  onConceptClick?: (conceptId: string) => void;
  // on-demand 설명을 불러오는 중인 conceptId들(lazy 개념 설명).
  explainingConcepts?: string[];
}

export default function ConceptSection({ concepts, activeConceptId, onConceptClick, explainingConcepts }: ConceptSectionProps) {
  useEffect(() => {
    if (!activeConceptId) return;
    const el = document.getElementById(`concept-${activeConceptId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeConceptId]);

  if (concepts.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        개념이 없다.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {concepts.map((concept) => {
        const isActive = activeConceptId === concept.conceptId;
        return (
          <button
            key={concept.conceptId}
            type="button"
            id={`concept-${concept.conceptId}`}
            onClick={() => onConceptClick?.(concept.conceptId)}
            aria-label={`${concept.title} 개념 선택`}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              isActive
                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {concept.title}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {(() => {
                  const desc = CONCEPT_DESCRIPTIONS[concept.conceptId];
                  if (!desc) return null;
                  const isIntermediate = desc.level === "intermediate";
                  return (
                    <span className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-xs font-medium ${
                      isIntermediate
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    }`}>
                      {LEVEL_LABEL[desc.level]}
                    </span>
                  );
                })()}
                <span className="inline-flex items-center rounded-lg bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  ×{concept.count}
                </span>
              </div>
            </div>
            {concept.lines.length > 0 && (
              <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                {concept.lines.join(", ")}번 줄
              </p>
            )}
            {isActive && (() => {
              const desc = concept.description ?? CONCEPT_DESCRIPTIONS[concept.conceptId]?.short;
              if (desc) {
                return (
                  <p className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                    {desc}
                  </p>
                );
              }
              if (explainingConcepts?.includes(concept.conceptId)) {
                return (
                  <p className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                    설명 불러오는 중…
                  </p>
                );
              }
              return null;
            })()}
          </button>
        );
      })}
    </div>
  );
}
