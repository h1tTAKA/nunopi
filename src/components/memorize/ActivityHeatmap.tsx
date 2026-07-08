"use client";

import { useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { yearActivity, activityYearRange, currentStreak } from "@/lib/srs/activityLog";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };
const CELL = 12; // 셀 한 변(px)
const GAP = 3; // 셀 간격(px)
const SLOT = CELL + GAP; // 주 열 폭

// 잔디 4단계 색(0/1-2/3-5/6+) — 분석모드 북마크 lime(밝은 연두) 계열.
function heatColor(n: number): string {
  if (n === 0) return "bg-zinc-100 dark:bg-zinc-800";
  if (n <= 2) return "bg-lime-200 dark:bg-lime-900";
  if (n <= 5) return "bg-lime-400 dark:bg-lime-700";
  return "bg-lime-500 dark:bg-lime-400";
}

// 깃헙 컨트리뷰션式 학습 활동 히트맵 — 연도 단위(주×요일), 월/요일 라벨, 연도 네비.
export default function ActivityHeatmap({ now }: { now: Date }) {
  const t = useT();
  const { locale } = useLocale();
  const tag = LOCALE_TAG[locale] ?? "en-US";
  const range = useMemo(() => activityYearRange(now), [now]);
  const [year, setYear] = useState(range.max);
  const { weeks, months } = useMemo(() => yearActivity(year), [year]);
  const streak = useMemo(() => currentStreak(now), [now]);

  // 요일 라벨(Sun~Sat 중 Mon/Wed/Fri만). 2023-01-01 = 일요일 기준.
  const dow = (d: number) => new Date(2023, 0, 1 + d).toLocaleDateString(tag, { weekday: "short" });
  const monthName = (m: number) => new Date(2023, m, 1).toLocaleDateString(tag, { month: "short" });

  return (
    <div className="flex flex-col gap-2">
      {/* 헤더 — 제목 · 스트릭 · 연도 네비 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{t("mem.statHeatmap")}</h3>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
              🔥 {t("mem.statStreakDays").replace("{n}", String(streak))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setYear((y) => Math.max(range.min, y - 1))}
            disabled={year <= range.min}
            className="rounded p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="prev year"
          >
            <IconChevronLeft size={15} stroke={2} aria-hidden />
          </button>
          <span className="w-10 text-center font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => Math.min(range.max, y + 1))}
            disabled={year >= range.max}
            className="rounded p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="next year"
          >
            <IconChevronRight size={15} stroke={2} aria-hidden />
          </button>
        </div>
      </div>

      {/* 잔디 */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          {/* 월 라벨 — 주 열에 맞춰 절대 배치 */}
          <div className="relative h-3" style={{ marginLeft: 24, width: weeks.length * SLOT }}>
            {months.map((m) => (
              <span
                key={m.week}
                className="absolute whitespace-nowrap text-[9px] text-zinc-400 dark:text-zinc-500"
                style={{ left: m.week * SLOT }}
              >
                {monthName(m.month)}
              </span>
            ))}
          </div>
          {/* 요일 라벨 + 그리드 */}
          <div className="flex gap-1">
            <div className="grid w-5 grid-rows-7 text-[9px] text-zinc-400 dark:text-zinc-500" style={{ gap: GAP }}>
              {Array.from({ length: 7 }, (_, d) => (
                <span key={d} className="flex items-center leading-none" style={{ height: CELL }}>
                  {d === 1 || d === 3 || d === 5 ? dow(d) : ""}
                </span>
              ))}
            </div>
            <div className="grid grid-flow-col grid-rows-7" style={{ gap: GAP }}>
              {weeks.flatMap((w, wi) =>
                w.map((cell, di) => (
                  <div
                    key={`${wi}-${di}`}
                    title={cell.date ? `${cell.date} · ${cell.count}` : undefined}
                    className={`rounded-[2px] ${cell.date ? heatColor(cell.count) : "bg-transparent"}`}
                    style={{ width: CELL, height: CELL }}
                  />
                )),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
