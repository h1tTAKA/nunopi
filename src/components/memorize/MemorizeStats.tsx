"use client";

import { useMemo } from "react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { categoryCounts, type CardCategory } from "@/lib/srs/due";
import { boxDistribution, summary, dueForecast } from "@/lib/srs/stats";
import { BOX_INTERVALS } from "@/lib/srs/schedule";
import { activityHeatmap, currentStreak } from "@/lib/srs/activityLog";
import type { Deck, SrsSource } from "@/lib/srs/types";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };

// 분류 색(도넛/범례). due.ts cardCategory와 대응.
const CAT_META: { key: CardCategory; tKey: string; color: string }[] = [
  { key: "good", tKey: "mem.good", color: "#10b981" },
  { key: "hard", tKey: "mem.hard", color: "#f59e0b" },
  { key: "again", tKey: "mem.again", color: "#f43f5e" },
  { key: "none", tKey: "mem.catNone", color: "#a1a1aa" },
];

// 왼쪽 학습 통계 패널 — 현재 SRS 상태 기반(요약·박스분포·분류도넛·7일예보). deck+sources 실시간.
export default function MemorizeStats({ deck, sources }: { deck: Deck; sources?: SrsSource[] }) {
  const t = useT();
  const { locale } = useLocale();
  const now = useMemo(() => new Date(), []);

  const sum = useMemo(() => summary(deck, now, sources), [deck, now, sources]);
  const boxes = useMemo(() => boxDistribution(deck, now, sources), [deck, now, sources]);
  const cats = useMemo(() => categoryCounts(deck, now, sources), [deck, now, sources]);
  const forecast = useMemo(() => dueForecast(deck, now, sources, 7), [deck, now, sources]);
  // 활동/스트릭은 전역(모든 복습, 덱 무관).
  const heatmap = useMemo(() => activityHeatmap(now, 17), [now]);
  const streak = useMemo(() => currentStreak(now), [now]);

  if (sum.total === 0) {
    return (
      <div className="flex h-full flex-col gap-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{t("mem.statsTitle")}</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("mem.statEmpty")}</p>
      </div>
    );
  }

  const boxMax = Math.max(1, ...boxes);
  const catTotal = CAT_META.reduce((n, c) => n + cats[c.key], 0);
  const fcMax = Math.max(1, ...forecast.map((f) => f.count));

  return (
    <div className="flex max-h-[calc(100vh-8rem)] flex-col gap-5 overflow-y-auto pr-1">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{t("mem.statsTitle")}</h2>

      {/* 요약 4칸 */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label={t("mem.statTotal")} value={String(sum.total)} />
        <StatCard label={t("mem.statDue")} value={String(sum.due)} accent />
        <StatCard label={t("mem.statAccuracy")} value={`${Math.round(sum.accuracy * 100)}%`} />
        <StatCard label={t("mem.statReviews")} value={String(sum.reviews)} />
      </div>

      {/* Leitner 박스 분포 */}
      <Section title={t("mem.statBoxDist")}>
        <div className="flex flex-col gap-1.5">
          {boxes.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex w-16 shrink-0 items-baseline gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                {t("mem.statBoxN").replace("{n}", String(i + 1))}
                <span className="text-[9px] text-zinc-300 dark:text-zinc-600">
                  {t("mem.statBoxDays").replace("{n}", String(BOX_INTERVALS[i]))}
                </span>
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded bg-blue-500 transition-all dark:bg-blue-400"
                  style={{ width: `${(n / boxMax) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">{n}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 분류 도넛 */}
      <Section title={t("mem.statCategoryDist")}>
        <div className="flex items-center gap-4">
          <Donut segments={CAT_META.map((c) => ({ value: cats[c.key], color: c.color }))} total={catTotal} />
          <div className="flex flex-col gap-1">
            {CAT_META.map((c) => (
              <div key={c.key} className="flex items-center gap-1.5 text-[11px]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="text-zinc-500 dark:text-zinc-400">{t(c.tKey)}</span>
                <span className="tabular-nums text-zinc-400 dark:text-zinc-500">{cats[c.key]}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 7일 복습 예보 */}
      <Section title={t("mem.statForecast")}>
        <div className="flex items-end gap-1.5" style={{ height: "72px" }}>
          {forecast.map((f, i) => {
            // "yyyy-mm-dd"를 로컬 날짜로 파싱(new Date(문자열)은 UTC라 음수 UTC서 요일 밀림).
            const [yy, mm, dd] = f.date.split("-").map(Number);
            const d = new Date(yy, mm - 1, dd);
            const wd = d.toLocaleDateString(LOCALE_TAG[locale] ?? "en-US", { weekday: "short" });
            return (
              <div key={f.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">{f.count || ""}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t ${i === 0 ? "bg-blue-500 dark:bg-blue-400" : "bg-blue-300 dark:bg-blue-700"}`}
                    style={{ height: `${Math.max(f.count > 0 ? 8 : 2, (f.count / fcMax) * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-zinc-400 dark:text-zinc-500">{wd}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 학습 활동 히트맵 + 연속 스트릭 (전역) */}
      <Section title={t("mem.statHeatmap")}>
        {streak > 0 && (
          <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
            🔥 {t("mem.statStreakDays").replace("{n}", String(streak))}
          </span>
        )}
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {heatmap.map((cell) => (
            <div
              key={cell.date}
              title={`${cell.date} · ${cell.count}`}
              className={`h-2.5 w-2.5 rounded-sm ${heatColor(cell.count)}`}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

// 히트맵 4단계 색(0/1-2/3-5/6+).
function heatColor(n: number): string {
  if (n === 0) return "bg-zinc-100 dark:bg-zinc-800";
  if (n <= 2) return "bg-blue-200 dark:bg-blue-900";
  if (n <= 5) return "bg-blue-400 dark:bg-blue-700";
  return "bg-blue-600 dark:bg-blue-400";
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-zinc-200 p-2.5 dark:border-zinc-800">
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{label}</span>
      <span className={`text-lg font-semibold tabular-nums ${accent ? "text-blue-500 dark:text-blue-400" : "text-zinc-800 dark:text-zinc-100"}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

// SVG 도넛 — stroke-dasharray 세그먼트. 데이터 없으면 회색 링.
function Donut({ segments, total }: { segments: { value: number; color: string }[]; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0 -rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-zinc-100 dark:text-zinc-800" />
      {total > 0 &&
        segments.map((s, i) => {
          if (s.value === 0) return null;
          const len = (s.value / total) * c;
          const seg = (
            <circle
              key={i}
              cx="36"
              cy="36"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="10"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
    </svg>
  );
}
