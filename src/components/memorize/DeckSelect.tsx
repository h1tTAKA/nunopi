"use client";

import { useMemo, useState } from "react";
import { IconCode, IconFileText, IconStack2, IconCheck } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { deckStats, categoryCounts, sessionCount, type CardCategory } from "@/lib/srs/due";
import { findMemSession, clearMemSession } from "@/lib/memSession";
import { DECK_SOURCES, type CardOrder, type Deck, type SrsSource } from "@/lib/srs/types";

const ORDER_KEY = "nunopi:mem-order";
const CATS_KEY = "nunopi:mem-categories";
const CATEGORIES: { value: CardCategory; tKey: string }[] = [
  { value: "again", tKey: "mem.again" },
  { value: "hard", tKey: "mem.hard" },
  { value: "good", tKey: "mem.good" },
  { value: "none", tKey: "mem.catNone" },
];
const ORDERS: { value: CardOrder; tKey: string }[] = [
  { value: "newest", tKey: "mem.orderNewest" },
  { value: "oldest", tKey: "mem.orderOldest" },
  { value: "random", tKey: "mem.orderRandom" },
];

interface DeckSelectProps {
  // 덱/세부출처는 controlled — MemorizeView가 소유(왼쪽 통계 패널과 실시간 공유).
  deck: Deck;
  onDeckChange: (d: Deck) => void;
  codeSources: Set<SrsSource>;
  onCodeSourcesChange: (s: Set<SrsSource>) => void;
  // 선택한 덱 + 세부 출처 + 복습 모드(due/all) + 이어하기 + 카드 순서로 세션 시작.
  onStart: (deck: Deck, sources: SrsSource[], mode: "due" | "all", resume: boolean, order: CardOrder, categories: CardCategory[]) => void;
}

const DECK_META: { deck: Deck; tKey: string; Icon: typeof IconCode }[] = [
  { deck: "all", tKey: "mem.deckAll", Icon: IconStack2 },
  { deck: "code", tKey: "mem.deckCode", Icon: IconCode },
  { deck: "text", tKey: "mem.deckText", Icon: IconFileText },
];

// 덱 선택 화면 — 덱 3장(오늘 due/전체 배지) + 코드덱 세부 토글 + 시작.
export default function DeckSelect({ deck: selected, onDeckChange, codeSources, onCodeSourcesChange, onStart }: DeckSelectProps) {
  const t = useT();
  // 덱은 controlled(MemorizeView 소유). 나머지 옵션은 DeckSelect 내부 + localStorage 영속(lazy 초기화).
  const [mode, setModeRaw] = useState<"due" | "all">(() => {
    const m = localStorage.getItem("nunopi:mem-range");
    return m === "all" ? "all" : "due";
  });
  function setSelected(d: Deck) {
    onDeckChange(d);
  }
  function setMode(m: "due" | "all") {
    setModeRaw(m);
    try { localStorage.setItem("nunopi:mem-range", m); } catch { /* ignore */ }
  }
  // 카드 제시 순서 — localStorage 영속(lazy 초기화).
  const [order, setOrder] = useState<CardOrder>(() => {
    const s = localStorage.getItem(ORDER_KEY);
    return s === "newest" || s === "oldest" || s === "random" ? s : "newest";
  });
  function pickOrder(o: CardOrder) {
    setOrder(o);
    try { localStorage.setItem(ORDER_KEY, o); } catch { /* ignore */ }
  }
  // 분류 필터 — 빈 Set = "전체"(필터 없음). 기본 전체. localStorage 영속(lazy 초기화).
  const [cats, setCats] = useState<Set<CardCategory>>(() => {
    try {
      const raw = localStorage.getItem(CATS_KEY);
      const arr = raw ? (JSON.parse(raw) as CardCategory[]) : null;
      if (Array.isArray(arr)) return new Set(arr);
    } catch { /* ignore */ }
    return new Set();
  });
  function persistCats(next: Set<CardCategory>) {
    try { localStorage.setItem(CATS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  }
  function toggleCat(c: CardCategory) {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      persistCats(next);
      return next;
    });
  }
  // "전체" 선택 — 개별 분류 해제(빈 Set = 필터 없음).
  function selectAllCats() {
    const next = new Set<CardCategory>();
    setCats(next);
    persistCats(next);
  }
  // 코드덱 세부 출처(토큰/개념)는 controlled — MemorizeView 소유(통계 공유). 글덱은 term 통째.

  // 선택 덱의 유효 출처 — 코드덱은 토글 반영, 그 외는 덱 전체 출처.
  const effectiveSources = (deck: Deck): SrsSource[] =>
    deck === "code" ? [...codeSources] : DECK_SOURCES[deck];

  // 각 덱 통계 — now는 마운트 시 1회 고정(진입 시점 기준).
  const now = useMemo(() => new Date(), []);
  const stats = useMemo(
    () => ({
      code: deckStats("code", now, [...codeSources]),
      text: deckStats("text", now),
      all: deckStats("all", now),
    }),
    [now, codeSources],
  );
  // 선택 덱의 분류별 카드 수(체크박스 배지).
  const catCounts = useMemo(
    () => categoryCounts(selected, now, selected === "code" ? [...codeSources] : undefined),
    [selected, now, codeSources],
  );

  function toggleSource(s: SrsSource) {
    const next = new Set(codeSources);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onCodeSourcesChange(next);
  }

  const selectedStats = stats[selected];
  // 실제 세션에 들어갈 카드 수(범위 + 분류 필터 반영) — 시작 버튼 라벨/활성 기준.
  const startCount = useMemo(
    () => sessionCount(selected, now, mode, [...cats], selected === "code" ? [...codeSources] : undefined),
    [selected, now, mode, cats, codeSources],
  );
  const canStart = startCount > 0;
  // 진행 중 세션(이어하기) — 덱 기준(모드 무관). 저장 세션 그대로 복원한다.
  const resumeTarget = findMemSession(selected);

  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/40 p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
      <h2 className="text-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        {t("mem.selectDeck")}
      </h2>

      <div className="flex flex-col gap-3">
        {DECK_META.map(({ deck, tKey, Icon }) => {
          const s = stats[deck];
          const active = selected === deck;
          return (
            <div
              key={deck}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(deck)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(deck); } }}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-[#3B34E2] bg-[#3B34E2]/10 dark:border-[#3B34E2] dark:bg-[#3B34E2]/15"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              }`}
            >
              <Icon size={22} stroke={2} className="shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
              <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">{t(tKey)}</span>
              {s.total === 0 ? (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{t("mem.emptyBookmarks")}</span>
              ) : (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-[#3B34E2] dark:text-[#8b86f5]">{t("mem.today")} {s.due}</span>
                  {" · "}
                  {t("mem.total")} {s.total}
                </span>
              )}
              {/* 선택 덱 + 진행 중 세션: 이어서하기만(옵션과 독립, 저장 세션 그대로). */}
              {active && s.total > 0 && resumeTarget && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStart(selected, resumeTarget.session.sources, resumeTarget.mode, true, order, [...cats]); }}
                  className="shrink-0 rounded-lg bg-[#3B34E2] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#322bc9]"
                >
                  {t("mem.resume")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 옵션 — 라벨 행으로 그룹화 (헤딩 제거로 공간 확보) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        {/* 세부 출처(코드덱만) */}
        {selected === "code" && (
          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("mem.lblSource")}</span>
            <div className="flex flex-wrap gap-1.5">
              {(["token", "concept"] as SrsSource[]).map((s) => {
                const on = codeSources.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSource(s)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      on ? "bg-[#3B34E2] text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {on && <IconCheck size={13} stroke={2.5} aria-hidden />}
                    {t(s === "token" ? "mem.srcToken" : "mem.srcConcept")}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 복습 범위 */}
        <div className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("mem.lblRange")}</span>
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900">
            {(["due", "all"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-md px-4 py-1.5 font-medium transition ${
                  mode === m ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {t(m === "due" ? "mem.modeDue" : "mem.modeAll")}
              </button>
            ))}
          </div>
        </div>

        {/* 순서 */}
        <div className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("mem.lblOrder")}</span>
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900">
            {ORDERS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pickOrder(o.value)}
                aria-pressed={order === o.value}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  order === o.value ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {t(o.tKey)}
              </button>
            ))}
          </div>
        </div>

        {/* 상태(분류) */}
        <div className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("mem.lblCategory")}</span>
          <div className="flex flex-wrap gap-1.5">
            {/* 전체 = 빈 필터. 누르면 개별 선택 해제. */}
            <button
              type="button"
              onClick={selectAllCats}
              aria-pressed={cats.size === 0}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                cats.size === 0 ? "bg-[#3B34E2] text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {cats.size === 0 && <IconCheck size={12} stroke={2.5} aria-hidden />}
              {t("mem.catAll")} {selectedStats.total}
            </button>
            {CATEGORIES.map((c) => {
              const on = cats.has(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCat(c.value)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    on ? "bg-[#3B34E2] text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {on && <IconCheck size={12} stroke={2.5} aria-hidden />}
                  {t(c.tKey)} {catCounts[c.value]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 시작하기 — 새 세션(진행 중 세션 있으면 덮어씀). */}
      <button
        type="button"
        disabled={!canStart}
        onClick={() => { clearMemSession(selected, mode); onStart(selected, effectiveSources(selected), mode, false, order, [...cats]); }}
        className="mt-1 rounded-xl bg-[#3B34E2] py-2.5 text-sm font-semibold text-white transition hover:bg-[#322bc9] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mode === "due" && selectedStats.total > 0 && startCount === 0
          ? t("mem.noDueToday")
          : `${t("mem.start")} · ${startCount}`}
      </button>
    </div>
  );
}
