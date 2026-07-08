"use client";

import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import { BOX_INTERVALS, MAX_BOX } from "@/lib/srs/schedule";
import type { Card } from "@/lib/srs/types";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };

// 이 카드의 Leitner 암기 단계(1~MAX_BOX) — 계단 막대 + 현재 단계/간격 + 다음 복습일.
// 덱선택 왼쪽 전체집계(#399)와 달리 "지금 보는 카드" 개별 상태.
export default function CardStageBar({ card }: { card: Card }) {
  const t = useT();
  const { locale } = useLocale();
  // 손상 store 방어 — box를 1..MAX_BOX로 클램프.
  const box = Math.min(MAX_BOX, Math.max(1, Math.round(card.state.box) || 1));
  const interval = BOX_INTERVALS[box - 1];
  const next = new Date(card.state.nextReviewAt);
  const nextLabel = Number.isNaN(next.getTime())
    ? "—"
    : next.toLocaleDateString(LOCALE_TAG[locale] ?? "en-US");

  return (
    <div className="flex w-56 flex-col gap-2 rounded-xl border border-zinc-200 bg-white/60 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/40">
      <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {t("mem.cardStageTitle")}
      </span>

      {/* 5단계 계단 막대 — 현재 box까지 채움, 현재 칸 강조. */}
      <div className="flex items-end gap-1">
        {Array.from({ length: MAX_BOX }, (_, i) => {
          const stage = i + 1;
          const filled = stage <= box;
          const current = stage === box;
          return (
            <div key={stage} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-sm transition-all ${
                  current
                    ? "bg-blue-500 dark:bg-blue-400"
                    : filled
                      ? "bg-blue-300 dark:bg-blue-700"
                      : "bg-zinc-100 dark:bg-zinc-800"
                }`}
                style={{ height: `${8 + stage * 6}px` }}
              />
              <span className={`text-[9px] tabular-nums ${current ? "font-semibold text-blue-500 dark:text-blue-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>

      {/* 현재 단계 · 간격 */}
      <div className="flex items-baseline justify-between text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-700 dark:text-zinc-200">
          {t("mem.statBoxN").replace("{n}", String(box))}
        </span>
        <span className="text-zinc-400 dark:text-zinc-500">
          {t("mem.statBoxDays").replace("{n}", String(interval))}
        </span>
      </div>

      {/* 다음 복습일 */}
      <div className="flex items-baseline justify-between text-zinc-500 dark:text-zinc-400">
        <span>{t("mem.cardNextReview")}</span>
        <span className="tabular-nums text-zinc-400 dark:text-zinc-500">{nextLabel}</span>
      </div>
    </div>
  );
}
