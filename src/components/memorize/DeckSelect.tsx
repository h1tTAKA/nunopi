"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCode, IconFileText, IconStack2, IconCheck } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { deckStats, categoryCounts, type CardCategory } from "@/lib/srs/due";
import { hasMemSession, clearMemSession } from "@/lib/memSession";
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
  // 선택한 덱 + 세부 출처 + 복습 모드(due/all) + 이어하기 + 카드 순서로 세션 시작.
  onStart: (deck: Deck, sources: SrsSource[], mode: "due" | "all", resume: boolean, order: CardOrder, categories: CardCategory[]) => void;
}

const DECK_META: { deck: Deck; tKey: string; Icon: typeof IconCode }[] = [
  { deck: "code", tKey: "mem.deckCode", Icon: IconCode },
  { deck: "text", tKey: "mem.deckText", Icon: IconFileText },
  { deck: "all", tKey: "mem.deckAll", Icon: IconStack2 },
];

// 덱 선택 화면 — 덱 3장(오늘 due/전체 배지) + 코드덱 세부 토글 + 시작.
export default function DeckSelect({ onStart }: DeckSelectProps) {
  const t = useT();
  const [selected, setSelected] = useState<Deck>("code");
  // 복습 모드 — due(오늘) / all(상시 전체).
  const [mode, setMode] = useState<"due" | "all">("due");
  // 카드 제시 순서 — localStorage 영속.
  const [order, setOrder] = useState<CardOrder>("newest");
  useEffect(() => {
    const s = localStorage.getItem(ORDER_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s === "newest" || s === "oldest" || s === "random") setOrder(s);
  }, []);
  function pickOrder(o: CardOrder) {
    setOrder(o);
    try { localStorage.setItem(ORDER_KEY, o); } catch { /* ignore */ }
  }
  // 분류 필터 — 기본 4개 전체 체크. localStorage 영속.
  const [cats, setCats] = useState<Set<CardCategory>>(new Set(["again", "hard", "good", "none"]));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CATS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as CardCategory[];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Array.isArray(arr)) setCats(new Set(arr));
      }
    } catch { /* ignore */ }
  }, []);
  function toggleCat(c: CardCategory) {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      try { localStorage.setItem(CATS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }
  // 코드덱 세부 출처 토글(토큰/개념). 글덱은 term 통째(관련개념/IT용어 미분리).
  const [codeSources, setCodeSources] = useState<Set<SrsSource>>(new Set(["token", "concept"]));

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
    setCodeSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const selectedStats = stats[selected];
  // due 모드는 오늘 복습 카드가 있어야, all 모드는 카드가 하나라도 있으면 시작.
  const canStart = (mode === "all" ? selectedStats.total > 0 : selectedStats.due > 0) && cats.size > 0;
  // 진행 중 세션(이어하기 가능) 여부 — 선택 덱+모드 기준.
  const resumable = hasMemSession(selected, mode);

  return (
    <div className="flex w-full flex-col gap-4">
      <h2 className="text-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        {t("mem.selectDeck")}
      </h2>

      <div className="flex flex-col gap-3">
        {DECK_META.map(({ deck, tKey, Icon }) => {
          const s = stats[deck];
          const active = selected === deck;
          return (
            <button
              key={deck}
              type="button"
              onClick={() => setSelected(deck)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-blue-400 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/20"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              }`}
            >
              <Icon size={22} stroke={2} className="shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
              <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">{t(tKey)}</span>
              {s.total === 0 ? (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{t("mem.emptyBookmarks")}</span>
              ) : (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-blue-500 dark:text-blue-400">{t("mem.today")} {s.due}</span>
                  {" · "}
                  {t("mem.total")} {s.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 옵션 — 라벨 행으로 그룹화 */}
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
                      on ? "bg-blue-500 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
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
            {CATEGORIES.map((c) => {
              const on = cats.has(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCat(c.value)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    on ? "bg-blue-500 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
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

      {resumable ? (
        // 진행 중 세션 있음 — 이어서하기 + 새로하기.
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onStart(selected, effectiveSources(selected), mode, true, order, [...cats])}
            className="rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {t("mem.resume")}
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={() => { clearMemSession(selected, mode); onStart(selected, effectiveSources(selected), mode, false, order, [...cats]); }}
            className="rounded-xl border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("mem.startFresh")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canStart}
          onClick={() => onStart(selected, effectiveSources(selected), mode, false, order, [...cats])}
          className="mt-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mode === "due" && selectedStats.total > 0 && selectedStats.due === 0
            ? t("mem.noDueToday")
            : mode === "all"
              ? `${t("mem.start")} · ${selectedStats.total}`
              : t("mem.start")}
        </button>
      )}
    </div>
  );
}
