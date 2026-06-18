"use client";

import { useEffect, useState } from "react";
import type { AgentAnalyzeResponse, AgentProviderKind } from "@/lib/agent";
import type { HistoryEntry } from "@/lib/historyDB";
import AnalysisHistory from "@/components/translator/AnalysisHistory";
import ConceptSection from "./ConceptSection";
import LineExplanationList from "./LineExplanationList";
import TokenSection from "./TokenSection";

const BOOKMARKS_KEY = "nunopi:bookmark-tokens";

function formatResultAsMarkdown(result: AgentAnalyzeResponse): string {
  const lines = [
    `# 코드 분석 결과 (provider: ${result.providerId})`,
    `감지 언어: ${result.language}`,
    "",
    "## 요약",
    result.summary,
  ];

  if (result.lineExplanations.length > 0) {
    lines.push("", "## 줄별 설명");
    for (const item of result.lineExplanations) {
      const escapedCode = item.code.replaceAll("`", "\\`");
      lines.push("", `### ${item.line}번 줄`, `\`${escapedCode}\``, item.explanation);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "## 경고");
    for (const w of result.warnings) {
      lines.push(`- [${w.code}] ${w.message}`);
    }
  }

  return lines.join("\n");
}

interface LearningPanelProps {
  providerId: AgentProviderKind;
  isLoading: boolean;
  errorMessage: string | null;
  result: AgentAnalyzeResponse | null;
  code: string;
  historyEntries?: HistoryEntry[];
  onRestoreHistory?: (entry: HistoryEntry) => void;
  onDeleteHistory?: (id: string) => void;
  onClearHistory?: () => void;
  onUpdateHistory?: (id: string, changes: Partial<Pick<HistoryEntry, "isPinned" | "title">>) => void;
  currentHistoryId?: string | null;
  currentHistoryTitle?: string;
  currentHistoryIsPinned?: boolean;
  onSetCurrentTitle?: (title: string) => void;
  onToggleCurrentPin?: () => void;
}

export default function LearningPanel({
  providerId,
  isLoading,
  errorMessage,
  result,
  code,
  historyEntries = [],
  onRestoreHistory,
  onDeleteHistory,
  onClearHistory,
  onUpdateHistory,
  currentHistoryId,
  currentHistoryTitle,
  currentHistoryIsPinned = false,
  onSetCurrentTitle,
  onToggleCurrentPin,
}: LearningPanelProps) {
  const nonEmptyLineCount = code.trim().split(/\r?\n/).filter(Boolean).length;
  const [activeTab, setActiveTab] = useState<"analysis" | "history">("analysis");
  const [activeTokenIds, setActiveTokenIds] = useState<string[]>([]);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [bookmarkedTokenTexts, setBookmarkedTokenTexts] = useState<string[]>([]);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [headerEditing, setHeaderEditing] = useState(false);
  const [headerTitle, setHeaderTitle] = useState(currentHistoryTitle ?? "");

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(formatResultAsMarkdown(result));
      setCopied(true);
    } catch { /* ignore — clipboard may be unavailable */ }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setBookmarkedTokenTexts(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTokenIds([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveConceptId(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterBookmarked(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (result) setActiveTab("analysis");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCopied(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderTitle(currentHistoryTitle ?? "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderEditing(false);
  }, [result]);

  function handleBookmarkToggle(tokenText: string) {
    setBookmarkedTokenTexts((prev) => {
      const next = prev.includes(tokenText)
        ? prev.filter((t) => t !== tokenText)
        : [...prev, tokenText];
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

  function saveHeaderTitle() {
    setHeaderEditing(false);
    onSetCurrentTitle?.(headerTitle);
  }

  const entryHeader = currentHistoryId ? (
    <div className="flex items-center gap-2 min-w-0">
      {/* 고정 버튼: 비핀 상태에서는 outline ☆, 핀 상태에서는 filled ★ amber */}
      <button
        type="button"
        onClick={onToggleCurrentPin}
        className={`shrink-0 text-lg leading-none transition ${
          currentHistoryIsPinned
            ? "text-amber-500 dark:text-amber-400"
            : "text-zinc-300 hover:text-amber-400 dark:text-zinc-600 dark:hover:text-amber-500"
        }`}
        title={currentHistoryIsPinned ? "고정 해제" : "고정하기"}
        aria-label={currentHistoryIsPinned ? "고정 해제" : "이 분석 고정하기"}
      >
        {currentHistoryIsPinned ? "★" : "☆"}
      </button>
      {/* 제목 — 클릭 시 인라인 편집 */}
      {headerEditing ? (
        <input
          type="text"
          autoFocus
          value={headerTitle}
          onChange={(e) => setHeaderTitle(e.target.value)}
          onBlur={saveHeaderTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); saveHeaderTitle(); }
            if (e.key === "Escape") { setHeaderEditing(false); setHeaderTitle(currentHistoryTitle ?? ""); }
          }}
          className="flex-1 min-w-0 rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm font-medium text-zinc-800 outline-none dark:border-blue-600 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="분석 제목 편집"
        />
      ) : (
        <button
          type="button"
          onClick={() => { setHeaderTitle(currentHistoryTitle ?? ""); setHeaderEditing(true); }}
          className="flex-1 min-w-0 truncate text-left text-sm font-semibold text-zinc-800 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
          title="클릭하여 제목 편집"
        >
          {currentHistoryTitle || "제목 없음"}
        </button>
      )}
    </div>
  ) : null;

  const tabBar = (
    <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setActiveTab("analysis")}
        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
          activeTab === "analysis"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        학습 패널
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("history")}
        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
          activeTab === "history"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        히스토리{historyEntries.length > 0 ? ` ${historyEntries.length}` : ""}
      </button>
    </div>
  );

  if (activeTab === "history") {
    return (
      <div className="h-full p-6 space-y-4 overflow-y-auto">
        {entryHeader}
        {tabBar}
        {onRestoreHistory && onDeleteHistory && onClearHistory ? (
          <AnalysisHistory
            entries={historyEntries}
            onRestore={onRestoreHistory}
            onDelete={onDeleteHistory}
            onClear={onClearHistory}
            onUpdate={onUpdateHistory}
            alwaysOpen
          />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">히스토리가 없다.</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full p-6 space-y-4">
      {entryHeader}
      {tabBar}
      <div className="space-y-1">
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
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-200" />
          <span className="text-sm text-zinc-600 dark:text-zinc-300">분석 중…</span>
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
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {result.language}
                </span>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  요약
                </p>
              </div>
              <button
                type="button"
                onClick={() => { void handleCopyResult(); }}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                aria-label="분석 결과 클립보드에 복사"
              >
                {copied ? "복사됨 ✓" : "복사"}
              </button>
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
              key={result.createdAt}
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
                bookmarkedTokenTexts.includes(t.token),
              ).length;
              const displayTokens = filterBookmarked
                ? result.tokens.filter((t) => bookmarkedTokenTexts.includes(t.token))
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
                            setBookmarkedTokenTexts([]);
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
                    key={result.createdAt}
                    tokens={displayTokens}
                    activeTokenIds={activeTokenIds}
                    onTokenClick={handleTokenClick}
                    bookmarkedTokenTexts={bookmarkedTokenTexts}
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
