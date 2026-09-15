"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { yearActivity, activityYearRange, currentStreak, type HeatCell } from "@/lib/srs/activityLog";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };
const CELL = 10; // 셀 높이(px) — 폭은 열 1fr로 유동
const GAP = 3; // 셀 간격(px)
const WEEKDAY_W = 20; // 좌측 요일 라벨 열 폭(px)

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
  // 커스텀 호버 툴팁(네이티브 title은 딜레이·미표시라 직접 그림).
  const [hover, setHover] = useState<{ cell: HeatCell; x: number; y: number } | null>(null);

  // 요일 라벨(Sun~Sat 중 Mon/Wed/Fri만). 2023-01-01 = 일요일 기준.
  const dow = (d: number) => new Date(2023, 0, 1 + d).toLocaleDateString(tag, { weekday: "short" });
  const monthName = (m: number) => new Date(2023, m, 1).toLocaleDateString(tag, { month: "short" });

  return (
    <div className="flex flex-col gap-2">
      {/* 헤더 — 제목 · 스트릭 · 연도 네비 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-white">{t("mem.statHeatmap")}</h3>
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

      {/* 잔디 — 패널 폭에 맞춰 반응형(열 1fr로 채움, 짤림/스크롤 없음). */}
      <div className="flex flex-col gap-1">
        {/* 월 라벨 — 요일 열(w-5) 만큼 밀고, 주 위치는 %로(유동 열에 정렬) */}
        <div className="relative h-3" style={{ marginLeft: WEEKDAY_W + 4 }}>
          {months.map((m) => (
            <span
              key={m.week}
              className="absolute whitespace-nowrap text-[9px] text-zinc-400 dark:text-zinc-500"
              style={{ left: `${(m.week / weeks.length) * 100}%` }}
            >
              {monthName(m.month)}
            </span>
          ))}
        </div>
        {/* 요일 라벨 + 그리드 */}
        <div className="flex gap-1">
          <div className="grid shrink-0 grid-rows-7 text-[9px] text-zinc-400 dark:text-zinc-500" style={{ gap: GAP, width: WEEKDAY_W }}>
            {Array.from({ length: 7 }, (_, d) => (
              <span key={d} className="flex items-center leading-none" style={{ height: CELL }}>
                {d === 1 || d === 3 || d === 5 ? dow(d) : ""}
              </span>
            ))}
          </div>
          {/* 열=주 1fr로 폭 채움. 셀 폭 유동, 높이 고정. */}
          <div className="grid min-w-0 flex-1 grid-flow-col grid-rows-7" style={{ gap: GAP, gridAutoColumns: "minmax(0,1fr)" }}>
            {weeks.flatMap((w, wi) =>
              w.map((cell, di) => (
                <div
                  key={`${wi}-${di}`}
                  onMouseEnter={cell.date && (cell.count > 0 || cell.added > 0) ? (e) => setHover({ cell, x: e.clientX, y: e.clientY }) : undefined}
                  onMouseMove={cell.date && (cell.count > 0 || cell.added > 0) ? (e) => setHover({ cell, x: e.clientX, y: e.clientY }) : undefined}
                  onMouseLeave={() => setHover(null)}
                  className={`rounded-[2px] ${cell.date ? heatColor(cell.count) : "bg-transparent"}`}
                  style={{ height: CELL }}
                />
              )),
            )}
          </div>
        </div>
        {/* Less → More 범례(우측) */}
        <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-zinc-400 dark:text-zinc-500">
          <span>{t("mem.statLess")}</span>
          {["bg-zinc-100 dark:bg-zinc-800", "bg-lime-200 dark:bg-lime-900", "bg-lime-400 dark:bg-lime-700", "bg-lime-500 dark:bg-lime-400"].map((c, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />
          ))}
          <span>{t("mem.statMore")}</span>
        </div>
      </div>

      {/* 호버 툴팁 — 포탈(패널 overflow에 안 잘리게), 커서 위 고정 */}
      {hover && typeof document !== "undefined" && createPortal(
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] leading-relaxed shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <div className="mb-0.5 font-semibold text-zinc-700 dark:text-zinc-100">{hover.cell.date}</div>
          <div className="flex gap-2 text-zinc-500 dark:text-zinc-300">
            <span>{t("mem.statReviews")} {hover.cell.count}</span>
            <span>{t("mem.statAdded")} {hover.cell.added}</span>
          </div>
          {hover.cell.again + hover.cell.hard + hover.cell.good > 0 && (
            <div className="flex gap-2">
              <span className="text-rose-500 dark:text-rose-400">{t("mem.again")} {hover.cell.again}</span>
              <span className="text-amber-500 dark:text-amber-400">{t("mem.hard")} {hover.cell.hard}</span>
              <span className="text-emerald-500 dark:text-emerald-400">{t("mem.good")} {hover.cell.good}</span>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
