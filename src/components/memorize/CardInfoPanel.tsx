"use client";

import { useLocale } from "@/lib/i18n/I18nProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Card, SrsSource } from "@/lib/srs/types";

const SOURCE_LABEL: Record<Card["source"], string> = {
  token: "mem.srcToken",
  concept: "mem.srcConcept",
  term: "mem.srcTerm",
};

const RECLASSIFY_OPTIONS: SrsSource[] = ["token", "concept", "term"];

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };

// 현재 카드 메타 — 출처 · 습득일 · 총 복습 · 다시/애매/완벽 누적.
// onReclassify 주어지면(=peek) 분류를 드롭다운으로 바꿀 수 있다(세션 중엔 미제공).
export default function CardInfoPanel({ card, onReclassify }: { card: Card; onReclassify?: (next: SrsSource) => void }) {
  const t = useT();
  const { locale } = useLocale();
  const g = card.state.grades ?? { again: 0, hard: 0, good: 0 };
  const reviews = card.state.reviews ?? 0;
  const acquired = card.bookmarkedAt
    ? new Date(card.bookmarkedAt).toLocaleDateString(LOCALE_TAG[locale] ?? "en-US")
    : "—";

  return (
    <div className="flex w-56 flex-col gap-2 rounded-xl border border-zinc-200 bg-white/60 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/40">
      {/* 출처 = 담은 분석의 제목 */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{t("mem.source")}</span>
        <span className="line-clamp-2 font-semibold text-zinc-700 dark:text-zinc-200">
          {card.sourceTitle?.trim() || t("mem.sourceUnknown")}
        </span>
      </div>
      {/* 분류 · 습득일 — onReclassify 있으면 분류를 드롭다운으로 변경 가능 */}
      <div className="flex items-center justify-between gap-2 text-zinc-500 dark:text-zinc-400">
        {onReclassify ? (
          <span className="flex items-center gap-1">
            {t("mem.category")}:
            <select
              value={card.source}
              onChange={(e) => onReclassify(e.target.value as SrsSource)}
              className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px] text-zinc-700 outline-none focus:border-[#3B34E2] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {RECLASSIFY_OPTIONS.map((s) => <option key={s} value={s}>{t(SOURCE_LABEL[s])}</option>)}
            </select>
          </span>
        ) : (
          <span>{t("mem.category")}: {t(SOURCE_LABEL[card.source])}</span>
        )}
        <span className="shrink-0 text-zinc-400 dark:text-zinc-500">{acquired}</span>
      </div>
      <div className="text-zinc-500 dark:text-zinc-400">
        {t("mem.reviewsN").replace("{n}", String(reviews))}
      </div>
      <div className="flex gap-3">
        <span className="text-rose-500 dark:text-rose-400">{t("mem.again")} {g.again}</span>
        <span className="text-amber-500 dark:text-amber-400">{t("mem.hard")} {g.hard}</span>
        <span className="text-emerald-500 dark:text-emerald-400">{t("mem.good")} {g.good}</span>
      </div>
    </div>
  );
}
