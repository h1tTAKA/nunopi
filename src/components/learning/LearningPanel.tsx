"use client";

import { useEffect, useState } from "react";
import type { AgentAnalyzeResponse, AgentProviderKind } from "@/lib/agent";
import ConceptSection from "./ConceptSection";
import LineExplanationList from "./LineExplanationList";
import TokenSection from "./TokenSection";

const BOOKMARKS_KEY = "nunopi:bookmarks";

interface LearningPanelProps {
  providerId: AgentProviderKind;
  isLoading: boolean;
  errorMessage: string | null;
  result: AgentAnalyzeResponse | null;
  code: string;
}

export default function LearningPanel({
  providerId,
  isLoading,
  errorMessage,
  result,
  code,
}: LearningPanelProps) {
  const nonEmptyLineCount = code.trim().split(/\r?\n/).filter(Boolean).length;
  const [activeTokenIds, setActiveTokenIds] = useState<string[]>([]);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [bookmarkedTokenIds, setBookmarkedTokenIds] = useState<string[]>([]);
  const [filterBookmarked, setFilterBookmarked] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      if (raw) setBookmarkedTokenIds(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setActiveTokenIds([]);
    setActiveConceptId(null);
    setFilterBookmarked(false);
  }, [result]);

  function handleBookmarkToggle(tokenId: string) {
    setBookmarkedTokenIds((prev) => {
      const next = prev.includes(tokenId)
        ? prev.filter((id) => id !== tokenId)
        : [...prev, tokenId];
      try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      if (next.length === 0) setFilterBookmarked(false);
      return next;
    });
  }

  function handleTokenClick(tokenId: string, conceptId: string | undefined) {
    if (activeTokenIds.length === 1 && activeTokenIds[0] === tokenId) {
      setActiveTokenIds([]);
      setActiveConceptId(null);
    } else {
      setActiveTokenIds([tokenId]);
      setActiveConceptId(conceptId ?? null);
    }
  }

  function handleConceptClick(conceptId: string) {
    if (activeConceptId === conceptId) {
      setActiveConceptId(null);
      setActiveTokenIds([]);
    } else {
      const relatedTokenIds = (result?.tokens ?? [])
        .filter((t) => t.conceptId === conceptId)
        .map((t) => t.id);
      setActiveConceptId(conceptId);
      setActiveTokenIds(relatedTokenIds);
    }
  }

  return (
    <div className="h-full p-6 space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          학습 패널
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          현재 provider: <span className="font-medium text-zinc-700 dark:text-zinc-200">{providerId}</span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          현재 입력 코드 {nonEmptyLineCount}줄
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          상태: {isLoading ? "분석 중" : result ? "결과 도착" : errorMessage ? "오류" : "대기 중"}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          agent bridge API에 분석 요청을 보내는 중이다. 로딩 중에는 입력과 provider 선택이 잠깐 잠긴다.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-lg bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                {result.language}
              </span>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                요약
              </p>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {result.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400 dark:text-zinc-500">
              <span>{new Date(result.createdAt).toLocaleString("ko-KR")}</span>
              {result.usage?.inputTokens != null && (
                <span>입력 {result.usage.inputTokens}토큰</span>
              )}
              {result.usage?.outputTokens != null && (
                <span>출력 {result.usage.outputTokens}토큰</span>
              )}
              {result.usage?.estimatedCostUsd != null && (
                <span>${result.usage.estimatedCostUsd.toFixed(4)}</span>
              )}
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((warning, i) => {
                const colorClass =
                  warning.code === "PARSE_FAILED"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300"
                    : warning.code === "TOO_LONG"
                      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-950 dark:bg-blue-950/30 dark:text-blue-300"
                      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-950 dark:bg-amber-950/30 dark:text-amber-300";
                return (
                  <div
                    key={i}
                    className={`rounded-2xl border p-4 text-sm ${colorClass}`}
                  >
                    <span className="font-medium">[{warning.code}]</span>{" "}
                    {warning.message}
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              줄별 설명
            </p>
            <LineExplanationList
              lineExplanations={result.lineExplanations}
              tokens={result.tokens}
              onTokenClick={handleTokenClick}
              concepts={result.concepts}
              onConceptClick={handleConceptClick}
            />
          </div>

          <div>
            {(() => {
              const visibleBookmarkCount = result.tokens.filter((t) =>
                bookmarkedTokenIds.includes(t.id),
              ).length;
              const displayTokens = filterBookmarked
                ? result.tokens.filter((t) => bookmarkedTokenIds.includes(t.id))
                : result.tokens;
              return (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      토큰 사전
                    </p>
                    {visibleBookmarkCount > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setFilterBookmarked((v) => !v)}
                          className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-xs font-medium transition ${
                            filterBookmarked
                              ? "bg-amber-400 text-white dark:bg-amber-500"
                              : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-800/40"
                          }`}
                        >
                          북마크 {visibleBookmarkCount}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBookmarkedTokenIds([]);
                            setFilterBookmarked(false);
                            try { localStorage.removeItem(BOOKMARKS_KEY); } catch { /* ignore */ }
                          }}
                          className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                        >
                          모두 해제
                        </button>
                      </>
                    )}
                  </div>
                  <TokenSection
                    tokens={displayTokens}
                    activeTokenIds={activeTokenIds}
                    onTokenClick={handleTokenClick}
                    bookmarkedTokenIds={bookmarkedTokenIds}
                    onBookmarkToggle={handleBookmarkToggle}
                  />
                </>
              );
            })()}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              개념
            </p>
            <ConceptSection
              concepts={result.concepts}
              activeConceptId={activeConceptId}
              onConceptClick={handleConceptClick}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          아직 분석 결과가 없다. 버튼을 누르면 분석이 시작되고 결과가 이 패널에 표시된다.
        </div>
      )}
    </div>
  );
}
