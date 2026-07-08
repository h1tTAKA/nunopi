"use client";

import { useMemo } from "react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { weakestCards, recentlyAddedCards, upcomingCards, deckMaturity, type CardBrief } from "@/lib/srs/stats";
import type { Deck, SrsSource } from "@/lib/srs/types";
import { useFlyCard } from "./FlyCard";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };
const ACCENT = "#3B34E2";

// 하단 인사이트 위젯 4개 — 자주 틀리는/최근 추가/덱별 성숙도/곧 복습 예정.
export default function MemorizeInsights({ deck, sources, now }: { deck: Deck; sources?: SrsSource[]; now: Date }) {
  const t = useT();
  const throwCard = useFlyCard();
  const { locale } = useLocale();
  const tag = LOCALE_TAG[locale] ?? "en-US";
  const fmt = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(tag, { month: "short", day: "numeric" });
  };

  const weak = useMemo(() => weakestCards(deck, now, sources, 4), [deck, now, sources]);
  const recent = useMemo(() => recentlyAddedCards(deck, now, sources, 4), [deck, now, sources]);
  const upcoming = useMemo(() => upcomingCards(deck, now, sources, 4), [deck, now, sources]);
  const maturity = useMemo(() => deckMaturity(now), [now]);

  // 인사이트 항목 클릭 → 그 카드가 클릭 위치에서 3D로 날아온다(공유 FlyCardProvider).
  const fling = (c: CardBrief) => (e: React.MouseEvent<HTMLButtonElement>) =>
    throwCard({ front: c.front, back: c.back }, e.currentTarget.getBoundingClientRect());

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* 자주 틀리는 카드 */}
      <Widget title={t("mem.insWeak")}>
        {weak.length === 0 ? <Empty t={t} /> : weak.map((c) => (
          <Row key={c.key} front={c.front} onClick={fling(c)}
            right={c.again > 0
              ? <span className="text-rose-500 dark:text-rose-400">{t("mem.again")} {c.again}</span>
              : <span className="text-amber-500 dark:text-amber-400">{t("mem.hard")} {c.hard}</span>} />
        ))}
      </Widget>

      {/* 최근 추가 */}
      <Widget title={t("mem.insRecent")}>
        {recent.length === 0 ? <Empty t={t} /> : recent.map((c) => (
          <Row key={c.key} front={c.front} onClick={fling(c)} right={<span className="text-zinc-400 dark:text-zinc-500">{fmt(c.bookmarkedAt)}</span>} />
        ))}
      </Widget>

      {/* 덱별 성숙도 */}
      <Widget title={t("mem.insMaturity")}>
        {maturity.every((m) => m.total === 0) ? <Empty t={t} /> : maturity.map((m) => {
          const pct = m.total > 0 ? Math.round((m.mature / m.total) * 100) : 0;
          return (
            <div key={m.deck} className="flex flex-col gap-1">
              {/* 이름은 바 위에(길어서 옆에 두면 레이아웃 깨짐) */}
              <div className="flex items-baseline justify-between text-[10px]">
                <span className="truncate text-zinc-400 dark:text-zinc-500">{m.deck === "code" ? t("mem.deckCode") : t("mem.deckText")}</span>
                <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded" style={{ width: `${pct}%`, background: ACCENT }} />
              </div>
            </div>
          );
        })}
      </Widget>

      {/* 곧 복습 예정 */}
      <Widget title={t("mem.insUpcoming")}>
        {upcoming.length === 0 ? <Empty t={t} /> : upcoming.map((c) => (
          <Row key={c.key} front={c.front} onClick={fling(c)} right={<span className="text-[#3B34E2] dark:text-[#8b86f5]">{fmt(c.nextReviewAt)}</span>} />
        ))}
      </Widget>
    </div>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white/40 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{title}</h4>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Row({ front, right, onClick }: { front: string; right: React.ReactNode; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={front}
      className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left text-[11px] transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">{front}</span>
      <span className="shrink-0 tabular-nums">{right}</span>
    </button>
  );
}

function Empty({ t }: { t: (k: string) => string }) {
  return <span className="text-[11px] text-zinc-300 dark:text-zinc-600">{t("mem.insEmpty")}</span>;
}
