"use client";

import { useEffect, useRef } from "react";
import type { AgentLineExplanation } from "@/lib/agent";
import type { CodeToken, ConceptOccurrence } from "@/lib/translator/types";
import { attachPanelWheelForward } from "@/lib/forwardPanelWheel";
import { tokenizeCodeLine } from "@/lib/tokenizeCodeLine";
import CodeBlock from "./CodeBlock";

interface LineExplanationListProps {
  lineExplanations: AgentLineExplanation[];
  tokens?: CodeToken[];
  onTokenClick?: (tokenId: string, conceptId: string | undefined) => void;
  // lazy 모드: 줄별 태그(텍스트) 클릭 시 on-demand 설명 요청.
  onTokenExplain?: (text: string, line: number) => void;
  concepts?: ConceptOccurrence[];
  onConceptClick?: (conceptId: string) => void;
  language?: string;
  // 에디터와 링크된 활성 줄 — 해당 카드를 강조.
  activeLine?: number | null;
  // 패널 스크롤 중 화면 상단에 보이는 줄을 알린다(우→좌 링크).
  onLineFocus?: (line: number) => void;
  // 분석 진행 중 — 줄별 설명이 아직 스트리밍으로 채워지는 중임을 알린다.
  isStreaming?: boolean;
  // 청크 진행률(완료/전체) — "남은 줄 분석 중" 안내용.
  chunkProgress?: { done: number; total: number } | null;
}

export default function LineExplanationList({
  lineExplanations,
  tokens = [],
  onTokenClick,
  onTokenExplain,
  language,
  concepts = [],
  onConceptClick,
  activeLine = null,
  onLineFocus,
  isStreaming = false,
  chunkProgress = null,
}: LineExplanationListProps) {
  // bounded 스크롤 박스 안에서 전체를 렌더(더보기 없이 스크롤).
  const visibleItems = lineExplanations;

  const containerRef = useRef<HTMLDivElement>(null);
  const onLineFocusRef = useRef(onLineFocus);
  const lastFocusedRef = useRef<number | null>(null);
  useEffect(() => {
    onLineFocusRef.current = onLineFocus;
  }, [onLineFocus]);

  // 박스가 경계/비스크롤이면 wheel을 전체 패널로 넘겨 어디서나 패널 스크롤.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    return attachPanelWheelForward(el);
  }, [visibleItems.length]);

  // 패널 스크롤 시 화면 상단에 가장 가까운 가시 카드의 줄을 onLineFocus로 알린다.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-nunopi-line]"),
    );
    if (cards.length === 0) return;
    const visible = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) visible.add(el);
          else visible.delete(el);
        }
        // 스크롤 박스 세로 중앙에 가장 가까운 카드를 "지금 보는 줄"로 선택.
        const boxRect = container.getBoundingClientRect();
        const boxCenter = boxRect.top + boxRect.height / 2;
        let best: HTMLElement | null = null;
        let bestDist = Infinity;
        for (const el of visible) {
          const rect = el.getBoundingClientRect();
          const dist = Math.abs(rect.top + rect.height / 2 - boxCenter);
          if (dist < bestDist) {
            bestDist = dist;
            best = el;
          }
        }
        if (!best) return;
        const line = Number(best.dataset.nunopiLine);
        if (Number.isFinite(line) && line !== lastFocusedRef.current) {
          lastFocusedRef.current = line;
          onLineFocusRef.current?.(line);
        }
      },
      // root를 줄별설명 스크롤 박스로 → 박스 중앙 띠를 지나는 카드를 활성으로(박스 위치 무관).
      { root: container, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [visibleItems.length]);

  // 청크 진행 안내 문구(있을 때만).
  const progressLabel =
    chunkProgress && chunkProgress.total > 0
      ? ` (${chunkProgress.done}/${chunkProgress.total} 조각)`
      : "";

  if (lineExplanations.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        {isStreaming
          ? `줄별 설명을 분석하는 중…${progressLabel} 잠시 후 순서대로 표시됩니다.`
          : "줄 설명이 없다."}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="nunopi-scroll max-h-[45vh] space-y-3 overflow-y-scroll overscroll-contain pr-1"
    >
      {visibleItems.map((item, i) => {
        // 칩은 모델 출력이 아니라 그 줄 코드를 클라에서 토큰화해 만든다(누락 0, 공백 뺀 전부).
        // 클릭 시 explain-token으로 on-demand 설명(#86).
        // 레거시(local-rules 등): item.tokenIds로 사전 토큰을 찾아 칩 표시(폴백).
        const tagTexts = tokenizeCodeLine(item.code);
        // item.tokenIds/conceptIds에 같은 id가 중복될 수 있어 먼저 유일화한다
        // (중복 시 같은 토큰/개념 버튼이 동일 key로 두 번 렌더돼 콘솔 에러).
        const lineTokens = Array.from(new Set(item.tokenIds ?? []))
          .map((id) => tokens.find((t) => t.id === id))
          .filter((t): t is CodeToken => t !== undefined);

        const lineConcepts = Array.from(new Set(item.conceptIds))
          .map((id) => concepts.find((c) => c.conceptId === id))
          .filter((c): c is ConceptOccurrence => c !== undefined);

        const isActive = item.line === activeLine;
        return (
          <div
            key={`${i}-${item.line}`}
            id={`nunopi-line-${item.line}`}
            data-nunopi-line={item.line}
            className={`scroll-mt-4 rounded-2xl border p-4 transition-colors ${
              isActive
                ? "border-blue-500 bg-blue-100 dark:border-blue-500 dark:bg-blue-950/30"
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
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
            <CodeBlock code={item.code} language={language} />
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
              {item.explanation}
            </p>
            {tagTexts.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tagTexts.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => onTokenExplain?.(text, item.line)}
                    className="inline-flex items-center rounded-lg bg-zinc-200 px-2 py-0.5 text-xs font-mono font-medium text-zinc-700 transition hover:bg-blue-100 hover:text-blue-700 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
                    aria-label={`${text} 설명 보기`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            ) : lineTokens.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lineTokens.map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    onClick={() => onTokenClick?.(token.id, token.conceptId)}
                    className="inline-flex items-center rounded-lg bg-zinc-200 px-2 py-0.5 text-xs font-mono font-medium text-zinc-700 transition hover:bg-blue-100 hover:text-blue-700 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
                    aria-label={`${token.token} 토큰으로 이동`}
                  >
                    {token.token}
                  </button>
                ))}
              </div>
            ) : null}
            {lineConcepts.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {lineConcepts.map((concept) => (
                  <button
                    key={concept.conceptId}
                    type="button"
                    onClick={() => onConceptClick?.(concept.conceptId)}
                    className="inline-flex items-center rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 transition hover:bg-violet-200 hover:text-violet-900 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-800/40 dark:hover:text-violet-200"
                    aria-label={`${concept.title} 개념으로 이동`}
                  >
                    {concept.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {isStreaming && (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-200" />
          남은 줄별 설명 분석 중…{progressLabel}
        </div>
      )}
    </div>
  );
}
