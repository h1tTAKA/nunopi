"use client";

import { useEffect, useMemo, useState } from "react";
import { IconFolder, IconTrash } from "@tabler/icons-react";
import { StarIcon } from "./icons";
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
  backfillTokenSource,
  backfillTermSource,
  backfillConceptSource,
} from "@/lib/bookmarkDetails";
import type { CodeToken, ConceptOccurrence, ItConcept, ItTerm } from "@/lib/translator/types";
import AnalysisHistory from "@/components/translator/AnalysisHistory";
import TokenDictionary from "./TokenDictionary";
import ItTermDictionary from "./ItTermDictionary";
import ConceptDictionary from "./ConceptDictionary";
import ConceptSection from "./ConceptSection";
import { CONCEPT_DESCRIPTIONS } from "./conceptDescriptions";
import LineExplanationList from "./LineExplanationList";
import ResizableBody from "./ResizableBody";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import TokenSection from "./TokenSection";
import ItTermSection from "./ItTermSection";
import ItConceptSection from "./ItConceptSection";
import { dedupeConcepts, dedupeTokens } from "@/lib/agent/dedupe";
import { formatResultAsHtml } from "@/lib/exportHtml";
import { reanchorLineNumbers, remapLines } from "@/lib/reanchorLines";
import { formatDuration } from "@/lib/formatDuration";

const BOOKMARKS_KEY = "nunopi:bookmark-tokens";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function formatResultAsMarkdown(result: AgentAnalyzeResponse, t: TFn): string {
  const heading = result.mode === "text" ? t("export.headingText") : t("export.headingCode");
  const lines = [
    `# ${heading} (provider: ${result.providerId})`,
    `${t("export.metaLanguage")}: ${result.language}`,
    "",
    `## ${t("export.summary")}`,
    result.summary,
  ];

  if (result.lineExplanations.length > 0) {
    lines.push("", `## ${t("export.lineExplanations")}`);
    for (const item of result.lineExplanations) {
      const escapedCode = item.code.replaceAll("`", "\\`");
      lines.push("", `### ${t("panel.lineN", { n: item.line })}`, `\`${escapedCode}\``, item.explanation);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", `## ${t("export.warnings")}`);
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
  // 토큰 사전은 분석 시 범용 토큰(token/category/lines)으로 자동 채워지고, 뜻은 카드 클릭 시
  // on-demand로 받는다(#505). explainingTokens는 로딩 표시용(토큰 텍스트). 삭제는 카드 제거용.
  explainingTokens?: string[];
  onTokenExplain?: (text: string) => void;
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
  const confirm = useConfirm();
  const t = useT();
  const { locale } = useLocale();
  const dateLocale = locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "ko-KR";
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
  // 활성(강조) 개념 id들 — 코드 모드는 1개([conceptId]), 글 모드는 용어의 관련 개념 전부.
  const [activeConceptIds, setActiveConceptIds] = useState<string[]>([]);
  // 설명 펼침은 active 하이라이트와 분리 — 카드 첫 클릭에 항상 열리게(active는 토큰 클릭으로도 설정되므로).
  const [expandedConceptIds, setExpandedConceptIds] = useState<string[]>([]);
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
  // 제목 헤더의 "목록에 담기" 인라인 패널 열림 여부 + 새 목록 이름 입력.
  const [headerCollMenu, setHeaderCollMenu] = useState(false);
  const [headerNewColl, setHeaderNewColl] = useState("");

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


  async function handleCopyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(formatResultAsMarkdown(result, t));
      setCopied(true);
    } catch { /* ignore — clipboard may be unavailable */ }
  }

  async function handleExportHtml() {
    if (!result) return;
    const html = await formatResultAsHtml(result, code, currentHistoryTitle, t, dateLocale);
    const datePart = new Date(result.createdAt).toISOString().slice(0, 10).replaceAll("-", "");
    const titlePart = (currentHistoryTitle?.trim() || t("export.fileDefault"))
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
    setActiveConceptIds([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedConceptIds([]);
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
    // result.createdAt 기준 — on-demand 토큰 append(같은 createdAt)엔 리셋 안 함(활성/스크롤 보존).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.createdAt]);

  // 현재 항목이 바뀌면(복원/저장 등) 목록 메뉴를 닫는다 — createdAt 안 바뀌는 경로(첫 저장
  // null→id)까지 커버. result.createdAt 효과의 다른 리셋엔 영향 안 주려 별도 effect로 분리.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderCollMenu(false);
    // 입력도 비운다 — 안 그러면 다른 항목 메뉴 열 때 이전 입력 텍스트가 남는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderNewColl("");
  }, [currentHistoryId]);

  // 북마크에 담을 "출처"(분석 제목) — 저장된 히스토리 제목 우선, 없으면 결과 자체 제목.
  function bookmarkSourceTitle(): string | undefined {
    return currentHistoryTitle?.trim() || result?.title?.trim() || undefined;
  }

  // 북마크에 담을 "출처 id"(분석 히스토리 id) — 나중에 카드에서 그 분석으로 이동할 때 쓴다.
  function bookmarkSourceId(): string | undefined {
    return currentHistoryId ?? undefined;
  }

  // 출처 소급 채움 — 이 분석에 등장한 북마크 중 sourceTitle이 없는 것(예전에 담은 것)을
  // 현재 분석 제목으로 채운다. 최초 출처 보존(이미 값 있으면 유지).
  useEffect(() => {
    const title = currentHistoryTitle?.trim() || result?.title?.trim();
    if (!title || !result) return;
    let changed = false;
    const id = currentHistoryId ?? undefined;
    for (const tk of result.tokens ?? []) if (backfillTokenSource(tk.token, title, id)) changed = true;
    for (const c of result.concepts ?? []) if (backfillConceptSource(c.title, title, id)) changed = true;
    for (const tm of result.terms ?? []) if (backfillTermSource(tm.term, title, id)) changed = true;
    for (const ic of result.itConcepts ?? []) if (backfillTermSource(ic.title, title, id)) changed = true;
    if (changed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBookmarkedTokenDetails(loadTokenDetails());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBookmarkedConceptDetails(loadConceptDetails());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBookmarkedTermDetails(loadTermDetails());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, currentHistoryTitle, currentHistoryId]);

  function handleBookmarkToggle(token: CodeToken) {
    const tokenText = token.token;
    // Compute isAdding synchronously before queueing updater
    const isAdding = !bookmarkedTokenTexts.includes(tokenText);
    // Run localStorage ops synchronously NOW so loadTokenDetails() gets fresh data
    if (isAdding) saveTokenDetail(token, bookmarkSourceTitle(), bookmarkSourceId());
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
    if (isAdding) saveTermDetail(term, bookmarkSourceTitle(), bookmarkSourceId());
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
    if (isAdding) saveTermDetail(asTerm, bookmarkSourceTitle(), bookmarkSourceId());
    else removeTermDetail(concept.title);
    const next = loadTermDetails();
    setBookmarkedTermDetails(next);
    if (Object.keys(next).length === 0) setFilterBookmarked(false);
  }

  function handleTokenClick(tokenId: string, conceptId: string | undefined) {
    if (activeTokenIds.length === 1 && activeTokenIds[0] === tokenId) {
      setActiveTokenIds([]);
      setActiveConceptIds([]);
    } else {
      setActiveTokenIds([tokenId]);
      setActiveConceptIds(conceptId ? [conceptId] : []);
    }
  }

  // 개념 북마크 토글 — 키=title. 현재 상태(설명 포함 가능) 스냅샷 저장.
  function handleConceptBookmarkToggle(concept: ConceptOccurrence) {
    const isAdding = !bookmarkedConceptDetails[concept.title];
    if (isAdding) saveConceptDetail(concept, bookmarkSourceTitle(), bookmarkSourceId());
    else removeConceptDetail(concept.title);
    setBookmarkedConceptDetails(loadConceptDetails());
  }

  function handleConceptClick(conceptId: string) {
    // 펼침 토글은 active(토큰 클릭으로도 설정됨)와 독립 → 첫 클릭에 항상 열림.
    const isOpen = expandedConceptIds.includes(conceptId);
    if (isOpen) {
      setExpandedConceptIds((prev) => prev.filter((id) => id !== conceptId));
      return;
    }
    setExpandedConceptIds((prev) => [...prev, conceptId]);
    // 열 때 관련 토큰 하이라이트 + 설명 없으면(정적 사전에도 없음) on-demand 요청.
    const relatedTokenIds = (result?.tokens ?? [])
      .filter((t) => t.conceptId === conceptId)
      .map((t) => t.id);
    setActiveConceptIds([conceptId]);
    setActiveTokenIds(relatedTokenIds);
    const concept = safeConcepts.find((c) => c.conceptId === conceptId);
    if (concept && !concept.description && !CONCEPT_DESCRIPTIONS[conceptId]) {
      onConceptExplain?.(conceptId, concept.title);
    }
  }

  // 글 모드: 용어 클릭 → 관련 개념 전부 강조 + 첫 개로 스크롤. 같은 세트 재클릭이면 해제(토글).
  function handleTermClick(conceptIds: string[]) {
    if (conceptIds.length === 0) return;
    setActiveConceptIds((prev) => {
      const sameSet =
        prev.length === conceptIds.length && prev.every((id) => conceptIds.includes(id));
      return sameSet ? [] : conceptIds;
    });
  }

  function saveHeaderTitle() {
    setHeaderEditing(false);
    onSetCurrentTitle?.(headerTitle);
  }

  // 헤더 목록 패널: 새 목록 만들어 현재 분석을 거기에 담는다(AnalysisHistory와 동일).
  function submitHeaderCreateCollection() {
    const name = headerNewColl.trim();
    if (!name || !currentHistoryId) return;
    const id = onCreateCollection?.(name);
    setHeaderNewColl("");
    if (id) onToggleEntryCollection?.(currentHistoryId, id);
  }

  const currentEntry = currentHistoryId
    ? historyEntries.find((e) => e.id === currentHistoryId)
    : undefined;

  const entryHeader = currentHistoryId ? (
    <div className="min-w-0">
    <div className="flex items-center gap-2 min-w-0">
      {/* 고정 버튼: 로고 라임 반짝임. 핀=채움, 비핀=외곽선. */}
      <button
        type="button"
        onClick={onToggleCurrentPin}
        className={`shrink-0 leading-none transition ${
          currentHistoryIsPinned
            ? "text-lime-600 dark:text-lime-400"
            : "text-zinc-400 hover:text-lime-600 dark:text-zinc-500 dark:hover:text-lime-400"
        }`}
        title={currentHistoryIsPinned ? "고정 해제" : "고정하기"}
        aria-label={currentHistoryIsPinned ? "고정 해제" : "이 분석 고정하기"}
      >
        <StarIcon filled={currentHistoryIsPinned} className="h-[18px] w-[18px]" />
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
          {currentHistoryTitle || t("panel.titleNone")}
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
          <IconFolder size={15} stroke={2} aria-hidden />
        </button>
      )}
      {/* 현재 분석 삭제 */}
      {onDeleteHistory && (
        <button
          type="button"
          onClick={async () => {
            if (await confirm({ message: t("confirm.deleteAnalysis"), confirmText: t("common.delete"), danger: true })) onDeleteHistory(currentHistoryId);
          }}
          className="shrink-0 rounded-lg px-1.5 py-1 text-xs text-zinc-400 transition hover:bg-red-100 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          title="이 분석 삭제"
          aria-label="이 분석 삭제"
        >
          <IconTrash size={15} stroke={2} aria-hidden />
        </button>
      )}
    </div>
    {/* 목록 멤버십 인라인 패널 (AnalysisHistory와 동일 패턴) */}
    {headerCollMenu && onToggleEntryCollection && (
      <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("panel.addToCollection")}</p>
        {(collections?.length ?? 0) === 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("panel.noCollectionsHint")}</p>
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
        {onCreateCollection && (
          <input
            type="text"
            value={headerNewColl}
            onChange={(e) => setHeaderNewColl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submitHeaderCreateCollection(); }
              if (e.key === "Escape") { setHeaderNewColl(""); setHeaderCollMenu(false); }
            }}
            placeholder={t("history.createAndAdd")}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-blue-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        )}
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
        {t("panel.tabLearning")}
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
        {t("panel.tabHistory")}{modeHistoryEntries.length > 0 ? ` ${modeHistoryEntries.length}` : ""}
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
        {mode === "text" ? t("panel.itTermDict") : t("panel.tokenDict")}
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
          {t("panel.tabConceptDict")}{bookmarkedConceptTitles.length > 0 ? ` ${bookmarkedConceptTitles.length}` : ""}
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("panel.historyEmpty")}</p>
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
          {t("panel.currentProvider")}: <span className="font-medium text-zinc-700 dark:text-zinc-200">{t(`provider.${providerId}`)}</span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {mode === "text"
            ? t("panel.inputText", { n: code.trim().length })
            : t("panel.inputCode", { n: nonEmptyLineCount })}
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {t("panel.status")}: {isLoading ? t("panel.stAnalyzing") : result ? t("panel.stResult") : errorMessage ? t("panel.stError") : t("panel.stIdle")}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-200" />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              {t("panel.spinAnalyzing")}{analysisStartedAt != null ? ` ${formatDuration(liveElapsedMs, locale)}` : ""}
              {chunkProgress && chunkProgress.total > 0
                ? t("panel.chunk", { done: chunkProgress.done, total: chunkProgress.total })
                : ""}
              {mode === "text" && result
                ? ` · ${
                    result.summary.trim()
                      ? t("panel.progSummary")
                      : (result.itConcepts?.length ?? 0) > 0
                        ? t("panel.progConcept", { n: result.itConcepts!.length })
                        : (result.terms?.length ?? 0) > 0
                          ? t("panel.progTerm", { n: result.terms!.length })
                          : t("panel.progTermExtract")
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-lg bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {result.mode === "text" ? t("panel.textLabel") : result.language}
                </span>
                <p className="whitespace-nowrap text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {t("panel.summary")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => { void handleCopyResult(); }}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  aria-label="분석 결과 클립보드에 복사"
                >
                  {copied ? t("panel.copied") : t("panel.copyResult")}
                </button>
                <button
                  type="button"
                  onClick={() => { void handleExportHtml(); }}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  aria-label="분석 결과를 HTML 파일로 저장"
                  title="나중에 보며 공부할 수 있게 HTML로 저장"
                >
                  {t("panel.saveHtml")}
                </button>
              </div>
            </div>
            {result.summary.trim() ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {result.summary}
              </p>
            ) : isLoading ? (
              <p className="mt-2 text-sm italic text-zinc-400 dark:text-zinc-500">
                {t("panel.summaryPending")}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {result.summary}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400 dark:text-zinc-500">
              <span>{new Date(result.createdAt).toLocaleString(dateLocale)}</span>
              {result.usage?.inputTokens != null && (
                <span>{t("panel.tokensInput", { n: result.usage.inputTokens })}</span>
              )}
              {result.usage?.outputTokens != null && (
                <span>{t("panel.tokensOutput", { n: result.usage.outputTokens })}</span>
              )}
              {elapsedMs != null && <span>{t("panel.elapsed", { d: formatDuration(elapsedMs, locale) })}</span>}
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
                          {t("panel.itTermDict")}
                        </p>
                        {bookmarkedCount > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setFilterBookmarked((v) => !v)}
                              className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-xs font-medium transition ${
                                filterBookmarked
                                  ? "bg-lime-600 text-white dark:bg-lime-600"
                                  : "bg-lime-100 text-lime-700 hover:bg-lime-200 dark:bg-lime-900/40 dark:text-lime-300 dark:hover:bg-lime-800/40"
                              }`}
                            >
                              {t("panel.bookmarkN", { n: bookmarkedCount })}
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
                              {t("panel.clearAll")}
                            </button>
                          </>
                        )}
                      </div>
                      <ResizableBody id="it-terms" defaultHeight={360}>
                        <ItTermSection
                          key={result.createdAt}
                          terms={displayTerms}
                          activeTermId={activeTermId}
                          onTermClick={handleTermClick}
                          bookmarkedTermTexts={bookmarkedTermTexts}
                          onBookmarkToggle={handleTermBookmarkToggle}
                          onExclude={(term) => onExclude?.("text", term.term)}
                        />
                      </ResizableBody>
                    </>
                  );
                })()}
              </section>
              <section className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t("panel.relatedConcept")}
                </p>
                {/* 내부 스크롤 캡(max-h+overscroll) 금지 — 박스가 뷰포트 하단에 걸치면
                    내부 바닥에서 패널 스크롤 전파가 막혀 꼬리가 영영 안 보인다(#356).
                    마지막 섹션이므로 패널(aside) 단일 스크롤로 흐르게 둔다. */}
                <div className="pr-1">
                  <ItConceptSection
                    concepts={result.itConcepts ?? []}
                    activeConceptIds={activeConceptIds}
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
              {t("panel.lineExplain")}
            </p>
            <ResizableBody id="lines" defaultHeight={440}>
              <LineExplanationList
                key={result.createdAt}
                lineExplanations={anchoredLineExplanations}
                concepts={safeConcepts}
                onConceptClick={handleConceptClick}
                language={result.language}
                activeLine={activeLine}
                onLineFocus={onLineFocus}
                isStreaming={isLoading}
                chunkProgress={chunkProgress}
              />
            </ResizableBody>
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
                      {t("panel.tokenDict")}
                    </p>
                    {visibleBookmarkCount > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setFilterBookmarked((v) => !v)}
                          className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-xs font-medium transition ${
                            filterBookmarked
                              ? "bg-lime-600 text-white dark:bg-lime-600"
                              : "bg-lime-100 text-lime-700 hover:bg-lime-200 dark:bg-lime-900/40 dark:text-lime-300 dark:hover:bg-lime-800/40"
                          }`}
                        >
                          {t("panel.bookmarkN", { n: visibleBookmarkCount })}
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
                          {t("panel.clearBookmarks")}
                        </button>
                      </>
                    )}
                  </div>
                  <ResizableBody id="tokens" defaultHeight={360}>
                    <TokenSection
                      key={result.createdAt}
                      tokens={displayTokens}
                      activeTokenIds={activeTokenIds}
                      onTokenClick={handleTokenClick}
                      explainingTokenTexts={explainingTokens}
                      onTokenExplain={(token) => onTokenExplain?.(token.token)}
                      bookmarkedTokenTexts={bookmarkedTokenTexts}
                      onBookmarkToggle={handleBookmarkToggle}
                      onTokenHover={setHoverLines}
                      onDelete={(token) => onDeleteToken?.(token.token)}
                      emptyHint={t("panel.tokenEmptyHint")}
                    />
                  </ResizableBody>
                </>
              );
            })()}
          </section>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("panel.concept")}
            </p>
            <ConceptSection
              concepts={safeConcepts}
              activeConceptId={activeConceptIds[0] ?? null}
              expandedConceptIds={expandedConceptIds}
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
          {t("panel.noResult")}
        </div>
      )}
    </div>
  );
}
