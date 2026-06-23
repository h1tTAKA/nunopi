"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentAnalyzeResponse, AgentProviderKind, AnalyzeMode } from "@/lib/agent";
import type { HistoryEntry } from "@/lib/historyDB";
import type { Collection } from "@/lib/collections";
import {
  type BookmarkedTokenDetail,
  type BookmarkedTermDetail,
  type BookmarkedConceptDetail,
  saveTokenDetail,
  removeTokenDetail,
  loadTokenDetails,
  clearTokenDetails,
  saveTermDetail,
  removeTermDetail,
  loadTermDetails,
  clearTermDetails,
  saveConceptDetail,
  removeConceptDetail,
  loadConceptDetails,
} from "@/lib/bookmarkDetails";
import type { CodeToken, ConceptOccurrence, ItConcept, ItTerm } from "@/lib/translator/types";
import AnalysisHistory from "@/components/translator/AnalysisHistory";
import TokenDictionary from "./TokenDictionary";
import ItTermDictionary from "./ItTermDictionary";
import ConceptDictionary from "./ConceptDictionary";
import ConceptSection from "./ConceptSection";
import { CONCEPT_DESCRIPTIONS } from "./conceptDescriptions";
import LineExplanationList from "./LineExplanationList";
import TokenSection from "./TokenSection";
import ItTermSection from "./ItTermSection";
import ItConceptSection from "./ItConceptSection";
import { dedupeConcepts, dedupeTokens } from "@/lib/agent/dedupe";
import { formatResultAsHtml } from "@/lib/exportHtml";
import { reanchorLineNumbers, remapLines } from "@/lib/reanchorLines";
import { formatDuration } from "@/lib/formatDuration";
import { attachPanelWheelForward } from "@/lib/forwardPanelWheel";

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
  mode?: AnalyzeMode;
  isLoading: boolean;
  progressLine?: string;
  analysisStartedAt?: number | null; // 진행 중 실시간 경과 타이머용 시작 시각(ms).
  elapsedMs?: number | null; // 직전 분석 총 소요시간(ms) — 완료 메타 표시용.
  chunkProgress?: { done: number; total: number } | null; // 청크 진행률(막대바). 단일 호출이면 null.
  errorMessage: string | null;
  result: AgentAnalyzeResponse | null;
  activeLine?: number | null;
  activeLineSource?: "editor" | "panel";
  onLineFocus?: (line: number) => void;
  // 글 원문에서 클릭한 IT 용어 id — 그 용어 카드로 스크롤(글 모드).
  activeTermId?: string | null;
  // 토큰 호버/클릭으로 에디터에서 강조할 코드 줄들을 상위(page)에 올린다.
  onMarkLines?: (lines: number[]) => void;
  // 제외(차단) 목록 — 표시에서 숨길 토큰/용어 텍스트. page에서 관리.
  excludedTerms?: string[];
  onExclude?: (mode: AnalyzeMode, text: string) => void;
  // lazy 토큰 사전 — 클릭해 받아온 토큰은 result.tokens에 합쳐져 사전에 표시된다.
  explainingTokens?: string[];
  onTokenExplain?: (text: string, line: number) => void;
  onDeleteToken?: (text: string) => void;
  // lazy 개념 설명 — 설명 없는 개념 클릭 시 on-demand 설명 요청.
  explainingConcepts?: string[];
  onConceptExplain?: (conceptId: string, title: string) => void;
  onDeleteConcept?: (conceptId: string) => void;
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
  // 사용자 목록(카테고리)
  collections?: Collection[];
  activeCollectionId?: string | null;
  onSelectCollection?: (id: string | null) => void;
  onCreateCollection?: (name: string) => string;
  onDeleteCollection?: (id: string) => void;
  onToggleEntryCollection?: (entryId: string, collectionId: string) => void;
}

export default function LearningPanel({
  providerId,
  mode = "code",
  isLoading,
  progressLine = "",
  analysisStartedAt = null,
  elapsedMs = null,
  chunkProgress = null,
  errorMessage,
  result,
  code,
  activeLine = null,
  activeLineSource,
  onLineFocus,
  activeTermId = null,
  onMarkLines,
  excludedTerms = [],
  onExclude,
  explainingTokens = [],
  onTokenExplain,
  onDeleteToken,
  explainingConcepts = [],
  onConceptExplain,
  onDeleteConcept,
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
  collections,
  activeCollectionId,
  onSelectCollection,
  onCreateCollection,
  onDeleteCollection,
  onToggleEntryCollection,
}: LearningPanelProps) {
  const nonEmptyLineCount = code.trim().split(/\r?\n/).filter(Boolean).length;

  // 분석 중 실시간 경과 타이머 — 1초마다 갱신. interval 콜백 setState라 set-state-in-effect 무관.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (!isLoading || analysisStartedAt == null) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isLoading, analysisStartedAt]);
  // 첫 tick(1s) 전엔 nowTick=0이거나 이전 분석값 → startedAt보다 작아 max(0,..)로 0초 표시.
  // 이후 1초마다 실제 경과. 음수만 클램프하면 충분(nowTick은 늘 startedAt 이후 시각으로 갱신).
  const liveElapsedMs =
    isLoading && analysisStartedAt != null ? Math.max(0, nowTick - analysisStartedAt) : 0;
  // 히스토리는 현재 모드 항목만 보여 코드/글이 섞이지 않게 한다.
  const modeHistoryEntries = historyEntries.filter((e) => (e.mode ?? "code") === mode);
  // 히스토리(IndexedDB)에서 복원한 옛 결과는 dedupe 이전 데이터라 중복
  // 토큰/개념을 담고 있을 수 있다 → 렌더 시점에도 방어적으로 중복 제거한다.
  const dedupedTokens = useMemo(() => dedupeTokens(result?.tokens ?? []), [result]);
  const dedupedConcepts = useMemo(() => dedupeConcepts(result?.concepts ?? []), [result]);
  // LLM이 매긴 줄번호는 부정확 → code 텍스트로 실제 행번호에 재앵커. lineMap으로
  // 토큰/개념의 lines도 같이 보정해, 줄 링크·토큰 하이라이트가 실제 코드와 일치하게 한다.
  const reanchor = useMemo(
    () => reanchorLineNumbers(code, result?.lineExplanations ?? []),
    [code, result],
  );
  const anchoredLineExplanations = reanchor.lineExplanations;
  const safeTokens = useMemo(
    () => dedupedTokens.map((t) => ({ ...t, lines: remapLines(t.lines, reanchor.lineMap) })),
    [dedupedTokens, reanchor],
  );
  const safeConcepts = useMemo(
    () => dedupedConcepts.map((c) => ({ ...c, lines: remapLines(c.lines ?? [], reanchor.lineMap) })),
    [dedupedConcepts, reanchor],
  );
  const [activeTab, setActiveTab] = useState<"analysis" | "history" | "dictionary" | "concept-dictionary">("analysis");
  const [activeTokenIds, setActiveTokenIds] = useState<string[]>([]);
  // 토큰 호버 시 임시 강조 줄(떼면 null). 에디터 하이라이트는 hover ?? 클릭고정.
  const [hoverLines, setHoverLines] = useState<number[] | null>(null);
  // 클릭으로 고정된 토큰(activeTokenIds)의 줄들.
  const pinnedLines = useMemo(
    () =>
      safeTokens
        .filter((t) => activeTokenIds.includes(t.id))
        .flatMap((t) => t.lines),
    [safeTokens, activeTokenIds],
  );
  // 에디터에 강조할 줄: 호버 중엔 호버 우선, 떼면 클릭 고정으로 복귀.
  const markedLines = hoverLines ?? pinnedLines;
  const markedKey = markedLines.join(",");
  useEffect(() => {
    onMarkLines?.(markedKey ? markedKey.split(",").map(Number) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markedKey]);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [bookmarkedTokenTexts, setBookmarkedTokenTexts] = useState<string[]>([]);
  const [bookmarkedTokenDetails, setBookmarkedTokenDetails] = useState<Record<string, BookmarkedTokenDetail>>({});
  // 글 모드 IT 용어 북마크 — details만 보관하고 texts는 키에서 파생한다.
  const [bookmarkedTermDetails, setBookmarkedTermDetails] = useState<Record<string, BookmarkedTermDetail>>({});
  const bookmarkedTermTexts = useMemo(() => Object.keys(bookmarkedTermDetails), [bookmarkedTermDetails]);
  // 개념 북마크 — 키 = 개념 title.
  const [bookmarkedConceptDetails, setBookmarkedConceptDetails] = useState<Record<string, BookmarkedConceptDetail>>({});
  const bookmarkedConceptTitles = useMemo(() => Object.keys(bookmarkedConceptDetails), [bookmarkedConceptDetails]);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [headerEditing, setHeaderEditing] = useState(false);
  const [headerTitle, setHeaderTitle] = useState(currentHistoryTitle ?? "");
  // 제목 헤더의 "목록에 담기" 인라인 패널 열림 여부.
  const [headerCollMenu, setHeaderCollMenu] = useState(false);
  const tokenBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // 에디터에서 줄 클릭(source "editor") 시 그 줄 설명 카드로 스크롤.
  // 패널 자체 스크롤(source "panel")로 생긴 변경엔 재스크롤하지 않는다(루프 차단).
  useEffect(() => {
    if (activeLine == null || activeLineSource !== "editor") return;
    const el = document.getElementById(`nunopi-line-${activeLine}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLine, activeLineSource]);

  // 글 원문에서 용어를 클릭하면(activeTermId) 분석 탭으로 전환 — ItTermSection이
  // 거기 있어야 그 카드로 스크롤된다(다른 탭이면 안 보임).
  useEffect(() => {
    // 다른 탭에 있으면 분석 탭으로 전환해야 용어 카드가 보인다. effect 내 동기 setState라
    // set-state-in-effect 룰에 걸리지만, prop(activeTermId) 변화에 반응하는 의도된 전환이다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTermId) setActiveTab("analysis");
  }, [activeTermId]);

  // 글 모드로 바뀌면 코드 전용 '개념 사전' 탭에서 빠져나온다(글 모드엔 그 탭이 없음).
  useEffect(() => {
    if (mode === "text" && activeTab === "concept-dictionary") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("analysis");
    }
  }, [mode, activeTab]);

  // 토큰 사전 박스가 경계/비스크롤이면 wheel을 전체 패널로 넘긴다(줄별 박스와 동일).
  useEffect(() => {
    const el = tokenBoxRef.current;
    if (!el) return;
    return attachPanelWheelForward(el);
  }, [result, activeTab]);

  async function handleCopyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(formatResultAsMarkdown(result));
      setCopied(true);
    } catch { /* ignore — clipboard may be unavailable */ }
  }

  async function handleExportHtml() {
    if (!result) return;
    const html = await formatResultAsHtml(result, code, currentHistoryTitle);
    const datePart = new Date(result.createdAt).toISOString().slice(0, 10).replaceAll("-", "");
    const titlePart = (currentHistoryTitle?.trim() || "분석")
      .replaceAll(/[\\/:*?"<>|]/g, "")
      .slice(0, 40);
    const filename = `nunopi-${titlePart}-${datePart}.html`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setBookmarkedTokenTexts(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookmarkedTokenDetails(loadTokenDetails());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookmarkedTermDetails(loadTermDetails());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookmarkedConceptDetails(loadConceptDetails());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTokenIds([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveConceptId(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterBookmarked(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoverLines(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (result) setActiveTab("analysis");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCopied(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderTitle(currentHistoryTitle ?? "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderEditing(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderCollMenu(false);
    // result.createdAt 기준 — on-demand 토큰 append(같은 createdAt)엔 리셋 안 함(활성/스크롤 보존).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.createdAt]);

  function handleBookmarkToggle(token: CodeToken) {
    const tokenText = token.token;
    // Compute isAdding synchronously before queueing updater
    const isAdding = !bookmarkedTokenTexts.includes(tokenText);
    // Run localStorage ops synchronously NOW so loadTokenDetails() gets fresh data
    if (isAdding) saveTokenDetail(token);
    else removeTokenDetail(tokenText);
    // Update details state immediately after localStorage is mutated
    setBookmarkedTokenDetails(loadTokenDetails());
    // Queue texts updater (runs later, but localStorage already updated)
    setBookmarkedTokenTexts((prev) => {
      const next = isAdding
        ? [...prev, tokenText]
        : prev.filter((t) => t !== tokenText);
      try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      if (next.length === 0) setFilterBookmarked(false);
      return next;
    });
  }

  // 글 모드 IT 용어 북마크 토글 — details(키=term)만 갱신, texts는 파생.
  function handleTermBookmarkToggle(term: ItTerm) {
    const isAdding = !bookmarkedTermDetails[term.term];
    if (isAdding) saveTermDetail(term);
    else removeTermDetail(term.term);
    const next = loadTermDetails();
    setBookmarkedTermDetails(next);
    if (Object.keys(next).length === 0) setFilterBookmarked(false);
  }

  // 글 모드 관련 개념 북마크 — 개념을 용어로 변환해 IT 용어 사전에 같이 저장(title 기준).
  function handleItConceptBookmarkToggle(concept: ItConcept) {
    const asTerm: ItTerm = {
      id: concept.conceptId,
      term: concept.title,
      explanation: concept.explanation,
      conceptIds: [],
      bookmarkable: true,
    };
    const isAdding = !bookmarkedTermDetails[concept.title];
    if (isAdding) saveTermDetail(asTerm);
    else removeTermDetail(concept.title);
    const next = loadTermDetails();
    setBookmarkedTermDetails(next);
    if (Object.keys(next).length === 0) setFilterBookmarked(false);
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

  // 개념 북마크 토글 — 키=title. 현재 상태(설명 포함 가능) 스냅샷 저장.
  function handleConceptBookmarkToggle(concept: ConceptOccurrence) {
    const isAdding = !bookmarkedConceptDetails[concept.title];
    if (isAdding) saveConceptDetail(concept);
    else removeConceptDetail(concept.title);
    setBookmarkedConceptDetails(loadConceptDetails());
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
      // 설명이 없고(정적 사전에도 없음) lazy면 on-demand 설명 요청.
      const concept = safeConcepts.find((c) => c.conceptId === conceptId);
      if (concept && !concept.description && !CONCEPT_DESCRIPTIONS[conceptId]) {
        onConceptExplain?.(conceptId, concept.title);
      }
    }
  }

  // 코드 모드 lazy: 줄별 태그 클릭 → 그 토큰 활성화(스크롤/하이라이트) + on-demand 설명 요청.
  function handleTokenTagExplain(text: string, line: number) {
    setActiveTokenIds([text]);
    onTokenExplain?.(text, line);
  }

  // 글 모드: 용어 클릭 → 첫 관련 개념으로 이동(ItConceptSection이 스크롤).
  function handleTermClick(conceptIds: string[]) {
    const first = conceptIds[0];
    if (!first) return;
    setActiveConceptId((prev) => (prev === first ? null : first));
  }

  function saveHeaderTitle() {
    setHeaderEditing(false);
    onSetCurrentTitle?.(headerTitle);
  }

  const currentEntry = currentHistoryId
    ? historyEntries.find((e) => e.id === currentHistoryId)
    : undefined;

  const entryHeader = currentHistoryId ? (
    <div className="min-w-0">
    <div className="flex items-center gap-2 min-w-0">
      {/* 고정 버튼: 비핀 상태에서는 outline ☆, 핀 상태에서는 filled ★ amber */}
      <button
        type="button"
        onClick={onToggleCurrentPin}
        className={`shrink-0 text-lg leading-none transition ${
          currentHistoryIsPinned
            ? "text-amber-500 dark:text-amber-400"
            : "text-zinc-400 hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400"
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
      {/* 목록에 담기 */}
      {onToggleEntryCollection && (
        <button
          type="button"
          onClick={() => setHeaderCollMenu((v) => !v)}
          className={`shrink-0 rounded-lg px-1.5 py-1 text-xs transition ${
            headerCollMenu || (currentEntry?.collectionIds?.length ?? 0) > 0
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
              : "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          }`}
          title="목록에 담기"
          aria-label="이 분석을 목록에 담기"
        >
          📁
        </button>
      )}
      {/* 현재 분석 삭제 */}
      {onDeleteHistory && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm("이 분석을 삭제할까? 되돌릴 수 없다.")) onDeleteHistory(currentHistoryId);
          }}
          className="shrink-0 rounded-lg px-1.5 py-1 text-xs text-zinc-400 transition hover:bg-red-100 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          title="이 분석 삭제"
          aria-label="이 분석 삭제"
        >
          🗑
        </button>
      )}
    </div>
    {/* 목록 멤버십 인라인 패널 (AnalysisHistory와 동일 패턴) */}
    {headerCollMenu && onToggleEntryCollection && (
      <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">목록에 담기</p>
        {(collections?.length ?? 0) === 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">아직 목록이 없다. 학습관리 탭에서 만들 수 있다.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(collections ?? []).map((c) => {
            const inIt = (currentEntry?.collectionIds ?? []).includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggleEntryCollection(currentHistoryId, c.id)}
                className={`rounded-lg px-2 py-0.5 text-xs transition ${
                  inIt
                    ? "bg-blue-500 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {inIt ? "✓ " : ""}{c.name}
              </button>
            );
          })}
        </div>
      </div>
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
        학습관리{modeHistoryEntries.length > 0 ? ` ${modeHistoryEntries.length}` : ""}
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("dictionary")}
        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
          activeTab === "dictionary"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        {mode === "text" ? "IT 용어 사전" : "토큰 사전"}
        {(() => {
          const n = mode === "text" ? bookmarkedTermTexts.length : Object.keys(bookmarkedTokenDetails).length;
          return n > 0 ? ` ${n}` : "";
        })()}
      </button>
      {mode !== "text" && (
        <button
          type="button"
          onClick={() => setActiveTab("concept-dictionary")}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
            activeTab === "concept-dictionary"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          개념 사전{bookmarkedConceptTitles.length > 0 ? ` ${bookmarkedConceptTitles.length}` : ""}
        </button>
      )}
    </div>
  );

  if (activeTab === "concept-dictionary" && mode !== "text") {
    return (
      <div className="nunopi-scroll h-full p-6 space-y-4 overflow-y-scroll">
        {entryHeader}
        {tabBar}
        <ConceptDictionary
          details={bookmarkedConceptDetails}
          onUnbookmark={(title) => {
            removeConceptDetail(title);
            setBookmarkedConceptDetails(loadConceptDetails());
          }}
        />
      </div>
    );
  }

  if (activeTab === "dictionary") {
    return (
      <div className="nunopi-scroll h-full p-6 space-y-4 overflow-y-scroll">
        {entryHeader}
        {tabBar}
        {mode === "text" ? (
          <ItTermDictionary
            details={bookmarkedTermDetails}
            onUnbookmark={(termText) => {
              removeTermDetail(termText);
              const next = loadTermDetails();
              setBookmarkedTermDetails(next);
              if (Object.keys(next).length === 0) setFilterBookmarked(false);
            }}
          />
        ) : (
          <TokenDictionary
            details={bookmarkedTokenDetails}
            onUnbookmark={(tokenText) => {
              // localStorage ops first, then state
              removeTokenDetail(tokenText);
              setBookmarkedTokenDetails(loadTokenDetails());
              setBookmarkedTokenTexts((prev) => {
                const next = prev.filter((t) => t !== tokenText);
                try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)); } catch {}
                if (next.length === 0) setFilterBookmarked(false);
                return next;
              });
            }}
          />
        )}
      </div>
    );
  }

  if (activeTab === "history") {
    return (
      <div className="nunopi-scroll h-full p-6 space-y-4 overflow-y-scroll">
        {entryHeader}
        {tabBar}
        {onRestoreHistory && onDeleteHistory && onClearHistory ? (
          <AnalysisHistory
            entries={modeHistoryEntries}
            onRestore={onRestoreHistory}
            onDelete={onDeleteHistory}
            onClear={onClearHistory}
            onUpdate={onUpdateHistory}
            alwaysOpen
            collections={collections}
            activeCollectionId={activeCollectionId}
            onSelectCollection={onSelectCollection}
            onCreateCollection={onCreateCollection}
            onDeleteCollection={onDeleteCollection}
            onToggleEntryCollection={onToggleEntryCollection}
          />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">분석 이력이 없다.</p>
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
          {mode === "text"
            ? `현재 입력 글 ${code.trim().length}자`
            : `현재 입력 코드 ${nonEmptyLineCount}줄`}
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          상태: {isLoading ? "분석 중" : result ? "결과 도착" : errorMessage ? "오류" : "대기 중"}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-200" />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              분석 중…{analysisStartedAt != null ? ` ${formatDuration(liveElapsedMs)}` : ""}
              {chunkProgress && chunkProgress.total > 0
                ? ` (${chunkProgress.done}/${chunkProgress.total} 조각)`
                : ""}
              {mode === "text" && result
                ? ` · ${
                    result.summary.trim()
                      ? "요약 정리 중…"
                      : (result.itConcepts?.length ?? 0) > 0
                        ? `관련 개념 분석 중 (${result.itConcepts!.length}개)`
                        : (result.terms?.length ?? 0) > 0
                          ? `용어 분석 중 (${result.terms!.length}개)`
                          : "용어 추출 중…"
                  }`
                : ""}
            </span>
          </div>
          {chunkProgress && chunkProgress.total > 0 ? (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300 dark:bg-blue-400"
                style={{ width: `${Math.round((chunkProgress.done / chunkProgress.total) * 100)}%` }}
              />
            </div>
          ) : mode === "text" ? (
            // 글 모드는 용어/개념 총 개수를 미리 모른다(% 막대 불가) → 미확정(움직이는) 막대로
            // "멈춘 게 아니라 진행 중"만 시각화.
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div className="h-full w-2/5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
            </div>
          ) : progressLine ? (
            <p className="mt-2 truncate font-mono text-xs text-zinc-400 dark:text-zinc-500">
              {progressLine}
            </p>
          ) : null}
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
                  {result.mode === "text" ? "글" : result.language}
                </span>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  요약
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => { void handleCopyResult(); }}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  aria-label="분석 결과 클립보드에 복사"
                >
                  {copied ? "복사됨 ✓" : "분석 결과 복사"}
                </button>
                <button
                  type="button"
                  onClick={() => { void handleExportHtml(); }}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  aria-label="분석 결과를 HTML 파일로 저장"
                  title="나중에 보며 공부할 수 있게 HTML로 저장"
                >
                  HTML 저장
                </button>
              </div>
            </div>
            {result.summary.trim() ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {result.summary}
              </p>
            ) : isLoading ? (
              <p className="mt-2 text-sm italic text-zinc-400 dark:text-zinc-500">
                분석이 끝나면 요약이 여기 정리된다…
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {result.summary}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400 dark:text-zinc-500">
              <span>{new Date(result.createdAt).toLocaleString("ko-KR")}</span>
              {result.usage?.inputTokens != null && (
                <span>입력 {result.usage.inputTokens}토큰</span>
              )}
              {result.usage?.outputTokens != null && (
                <span>출력 {result.usage.outputTokens}토큰</span>
              )}
              {elapsedMs != null && <span>소요 {formatDuration(elapsedMs)}</span>}
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

          {result.mode === "text" ? (
            <>
              <section className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                {(() => {
                  // 제외된 용어는 표시에서 제거한 뒤, 그 위에서 북마크 카운트/필터를 계산.
                  const availableTerms = (result.terms ?? []).filter((t) => !excludedTerms.includes(t.term));
                  const bookmarkedCount = availableTerms.filter((t) => bookmarkedTermTexts.includes(t.term)).length;
                  const displayTerms = filterBookmarked
                    ? availableTerms.filter((t) => bookmarkedTermTexts.includes(t.term))
                    : availableTerms;
                  return (
                    <>
                      <div className="mb-2 flex items-center gap-2 px-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          IT 용어 사전
                        </p>
                        {bookmarkedCount > 0 && (
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
                              북마크 {bookmarkedCount}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBookmarkedTermDetails({});
                                setFilterBookmarked(false);
                                clearTermDetails();
                              }}
                              className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                            >
                              모두 해제
                            </button>
                          </>
                        )}
                      </div>
                      <div className="nunopi-scroll max-h-[45vh] overflow-y-scroll overscroll-contain pr-1">
                        <ItTermSection
                          key={result.createdAt}
                          terms={displayTerms}
                          activeTermId={activeTermId}
                          onTermClick={handleTermClick}
                          bookmarkedTermTexts={bookmarkedTermTexts}
                          onBookmarkToggle={handleTermBookmarkToggle}
                          onExclude={(term) => onExclude?.("text", term.term)}
                        />
                      </div>
                    </>
                  );
                })()}
              </section>
              <section className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  관련 개념
                </p>
                <div className="nunopi-scroll max-h-[45vh] overflow-y-scroll overscroll-contain pr-1">
                  <ItConceptSection
                    concepts={result.itConcepts ?? []}
                    activeConceptId={activeConceptId}
                    onBookmarkToggle={handleItConceptBookmarkToggle}
                    bookmarkedTitles={bookmarkedTermTexts}
                    isStreaming={isLoading}
                  />
                </div>
              </section>
            </>
          ) : (
            <>
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              줄별 설명
            </p>
            <LineExplanationList
              key={result.createdAt}
              lineExplanations={anchoredLineExplanations}
              tokens={safeTokens}
              onTokenClick={handleTokenClick}
              onTokenExplain={handleTokenTagExplain}
              concepts={safeConcepts}
              onConceptClick={handleConceptClick}
              language={result.language}
              activeLine={activeLine}
              onLineFocus={onLineFocus}
              isStreaming={isLoading}
              chunkProgress={chunkProgress}
            />
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            {(() => {
              // 코드 토큰은 제외 없이, 북마크 카운트/필터만 적용.
              const visibleBookmarkCount = safeTokens.filter((t) =>
                bookmarkedTokenTexts.includes(t.token),
              ).length;
              const displayTokens = filterBookmarked
                ? safeTokens.filter((t) => bookmarkedTokenTexts.includes(t.token))
                : safeTokens;
              return (
                <>
                  <div className="mb-2 flex items-center gap-2 px-1">
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
                            setBookmarkedTokenDetails({});
                            setFilterBookmarked(false);
                            try { localStorage.removeItem(BOOKMARKS_KEY); } catch { /* ignore */ }
                            clearTokenDetails();
                          }}
                          className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                        >
                          모두 해제
                        </button>
                      </>
                    )}
                  </div>
                  {explainingTokens.length > 0 && (
                    <p className="mb-2 px-1 text-xs text-zinc-400 dark:text-zinc-500">
                      설명 불러오는 중: {explainingTokens.join(", ")}…
                    </p>
                  )}
                  <div ref={tokenBoxRef} className="nunopi-scroll max-h-[45vh] overflow-y-scroll overscroll-contain pr-1">
                    <TokenSection
                      key={result.createdAt}
                      tokens={displayTokens}
                      activeTokenIds={activeTokenIds}
                      onTokenClick={handleTokenClick}
                      bookmarkedTokenTexts={bookmarkedTokenTexts}
                      onBookmarkToggle={handleBookmarkToggle}
                      onTokenHover={setHoverLines}
                      onDelete={(token) => onDeleteToken?.(token.token)}
                      emptyHint="줄별 설명의 태그를 누르면 그 토큰 설명이 여기에 추가된다."
                    />
                  </div>
                </>
              );
            })()}
          </section>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              개념
            </p>
            <ConceptSection
              concepts={safeConcepts}
              activeConceptId={activeConceptId}
              onConceptClick={handleConceptClick}
              explainingConcepts={explainingConcepts}
              bookmarkedConceptTitles={bookmarkedConceptTitles}
              onBookmarkToggle={handleConceptBookmarkToggle}
              onDelete={onDeleteConcept}
            />
          </div>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          아직 분석 결과가 없다. 버튼을 누르면 분석이 시작되고 결과가 이 패널에 표시된다.
        </div>
      )}
    </div>
  );
}
