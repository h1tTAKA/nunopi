"use client";

import { useMemo } from "react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { weakestCards, recentlyAddedCards, upcomingCards, deckMaturity } from "@/lib/srs/stats";
import type { Deck, SrsSource } from "@/lib/srs/types";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };
const ACCENT = "#3B34E2";

// 하단 인사이트 위젯 4개 — 자주 틀리는/최근 추가/덱별 성숙도/곧 복습 예정.
export default function MemorizeInsights({ deck, sources, now }: { deck: Deck; sources?: SrsSource[]; now: Date }) {
  const t = useT();
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

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* 자주 틀리는 카드 */}
      <Widget title={t("mem.insWeak")}>
        {weak.length === 0 ? <Empty t={t} /> : weak.map((c) => (
          <Row key={c.key} front={c.front}
            right={<span className="text-rose-500 dark:text-rose-400">{t("mem.again")} {c.again}</span>} />
        ))}
      </Widget>

      {/* 최근 추가 */}
      <Widget title={t("mem.insRecent")}>
        {recent.length === 0 ? <Empty t={t} /> : recent.map((c) => (
          <Row key={c.key} front={c.front} right={<span className="text-zinc-400 dark:text-zinc-500">{fmt(c.bookmarkedAt)}</span>} />
        ))}
      </Widget>

      {/* 덱별 성숙도 */}
      <Widget title={t("mem.insMaturity")}>
        {maturity.every((m) => m.total === 0) ? <Empty t={t} /> : maturity.map((m) => {
          const pct = m.total > 0 ? Math.round((m.mature / m.total) * 100) : 0;
          return (
            <div key={m.deck} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">{m.deck === "code" ? t("mem.deckCode") : t("mem.deckText")}</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded" style={{ width: `${pct}%`, background: ACCENT }} />
              </div>
              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">{pct}%</span>
            </div>
          );
        })}
      </Widget>

      {/* 곧 복습 예정 */}
      <Widget title={t("mem.insUpcoming")}>
        {upcoming.length === 0 ? <Empty t={t} /> : upcoming.map((c) => (
          <Row key={c.key} front={c.front} right={<span className="text-[#3B34E2] dark:text-[#8b86f5]">{fmt(c.nextReviewAt)}</span>} />
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

function Row({ front, right }: { front: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">{front}</span>
      <span className="shrink-0 tabular-nums">{right}</span>
    </div>
  );
}

function Empty({ t }: { t: (k: string) => string }) {
  return <span className="text-[11px] text-zinc-300 dark:text-zinc-600">{t("mem.insEmpty")}</span>;
}
