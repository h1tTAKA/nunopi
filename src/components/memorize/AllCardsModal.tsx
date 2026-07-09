"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX, IconSearch } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { collectCards } from "@/lib/srs/collect";
import { cardCategory, type CardCategory } from "@/lib/srs/due";
import { DECK_SOURCES, type Card, type SrsSource } from "@/lib/srs/types";
import { useFlyCard } from "./FlyCard";

const SYMBOL = "/brand/nunopi-symbol-darkeye-transparent.png";

type SourceFilter = "all" | SrsSource;
type CatFilter = "all" | CardCategory;
type Sort = "recent" | "oldest" | "most" | "least";

const SOURCE_CHIPS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "mem.catAll" },
  { key: "token", label: "mem.srcToken" },
  { key: "concept", label: "mem.srcConceptFull" },
  { key: "term", label: "mem.srcTerm" },
];

const CAT_CHIPS: { key: CatFilter; label: string; dot: string }[] = [
  { key: "all", label: "mem.catAll", dot: "bg-zinc-400" },
  { key: "again", label: "mem.again", dot: "bg-rose-500" },
  { key: "hard", label: "mem.hard", dot: "bg-amber-500" },
  { key: "good", label: "mem.good", dot: "bg-emerald-500" },
  { key: "none", label: "mem.catNone", dot: "bg-zinc-300 dark:bg-zinc-600" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "recent", label: "mem.sortRecent" },
  { key: "oldest", label: "mem.sortOldest" },
  { key: "most", label: "mem.sortMostReviewed" },
  { key: "least", label: "mem.sortLeastReviewed" },
];

const CAT_DOT: Record<CardCategory, string> = {
  again: "bg-rose-500",
  hard: "bg-amber-500",
  good: "bg-emerald-500",
  none: "bg-zinc-300 dark:bg-zinc-600",
};

// 전체 보유 카드 갤러리 — 검색·출처/분류 필터·정렬. 타일 클릭 시 카드가 날아온다(peek 재사용).
export default function AllCardsModal({ now, active = true, autoThrowCardKey, onClose }: { now: Date; active?: boolean; autoThrowCardKey?: string; onClose: () => void }) {
  const t = useT();
  const { throwCard } = useFlyCard();
  const [q, setQ] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [cat, setCat] = useState<CatFilter>("all");
  const [sort, setSort] = useState<Sort>("recent");

  const all = useMemo(() => collectCards(DECK_SOURCES.all, now), [now]);

  // 출처로 이동(카드발) — 갤러리 열면서 생성처 카드를 바로 띄운다(peek). 마운트 시 1회.
  const threw = useRef(false);
  useEffect(() => {
    if (threw.current || !autoThrowCardKey) return;
    threw.current = true;
    const origin = all.find((c) => c.key === autoThrowCardKey);
    if (origin) throwCard(origin);
  }, [autoThrowCardKey, all, throwCard]);

  const cards = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = all;
    if (needle) list = list.filter((c) => c.front.toLowerCase().includes(needle));
    if (source !== "all") list = list.filter((c) => c.source === source);
    if (cat !== "all") list = list.filter((c) => cardCategory(c) === cat);
    const arr = [...list];
    arr.sort((a, b) => {
      if (sort === "most" || sort === "least") {
        const d = (b.state.reviews ?? 0) - (a.state.reviews ?? 0);
        return sort === "most" ? d : -d;
      }
      const cmp = (a.bookmarkedAt ?? "").localeCompare(b.bookmarkedAt ?? "");
      return sort === "recent" ? -cmp : cmp; // recent=최신 먼저
    });
    return arr;
  }, [all, q, source, cat, sort]);

  return createPortal(
    <div className={`fixed inset-x-0 bottom-0 top-14 z-[60] flex-col bg-zinc-50/95 backdrop-blur-sm dark:bg-[#0b0c10]/95 ${active ? "flex" : "hidden"}`}>
      {/* 헤더 — 제목 + 검색 + 닫기 */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h2 className="shrink-0 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {t("mem.allCardsTitle")} <span className="text-zinc-400 dark:text-zinc-500">{cards.length}</span>
        </h2>
        <div className="relative ml-2 max-w-xs flex-1">
          <IconSearch size={15} stroke={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("mem.searchCards")}
            className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-[#3B34E2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </div>
        <div className="flex-1" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {SORTS.map((s) => <option key={s.key} value={s.key}>{t(s.label)}</option>)}
        </select>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("mem.exit")}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <IconX size={15} stroke={2} aria-hidden />
          {t("mem.exit")}
        </button>
      </div>

      {/* 필터 칩 — 출처 + 분류 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_CHIPS.map((c) => (
            <Chip key={c.key} on={source === c.key} onClick={() => setSource(c.key)} label={t(c.label)} />
          ))}
        </div>
        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex flex-wrap gap-1.5">
          {CAT_CHIPS.map((c) => (
            <Chip key={c.key} on={cat === c.key} onClick={() => setCat(c.key)} label={t(c.label)} dot={c.dot} />
          ))}
        </div>
      </div>

      {/* 카드 격자 */}
      <div className="nunopi-scroll flex-1 overflow-y-auto px-6 py-5">
        {cards.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400 dark:text-zinc-600">
            {t("mem.noCardsFound")}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))" }}>
            {cards.map((c) => (
              <CardTile key={c.key} card={c} reviews={c.state.reviews ?? 0} onThrow={throwCard} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Chip({ on, onClick, label, dot }: { on: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
        on ? "bg-[#3B34E2] text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
    </button>
  );
}

// 게임 카드팩 느낌의 미니 타일 — 흰 포커카드 + 용어 + 출처 배지 + 분류 점 + 복습 수.
function CardTile({ card, reviews, onThrow, t }: { card: Card; reviews: number; onThrow: (c: Card, r?: DOMRect) => void; t: (k: string) => string }) {
  const SRC_LABEL: Record<Card["source"], string> = { token: "mem.srcToken", concept: "mem.srcConcept", term: "mem.srcTerm" };
  return (
    <button
      type="button"
      onClick={(e) => onThrow(card, e.currentTarget.getBoundingClientRect())}
      className="group relative flex aspect-[5/7] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-zinc-700"
    >
      <span className="pointer-events-none absolute inset-[6%] rounded-[10%] border-2 border-blue-500/50" />
      <span className="pointer-events-none absolute inset-[9%] rounded-[8%] border border-blue-500/30" />
      {/* 상단 배지 — 출처 + 분류 점 */}
      <span className="absolute left-2 top-2 flex items-center gap-1">
        <span className={`h-2 w-2 rounded-full ${CAT_DOT[cardCategory(card)]}`} />
      </span>
      <span className="absolute right-2 top-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[8px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {t(SRC_LABEL[card.source])}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SYMBOL} alt="" className="relative mt-2 h-6 w-6 object-contain" />
      <span className="relative line-clamp-3 text-xs font-bold leading-tight text-zinc-900">{card.front}</span>
      <span className="absolute bottom-2 text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
        {t("mem.reviewsShort").replace("{n}", String(reviews))}
      </span>
    </button>
  );
}
