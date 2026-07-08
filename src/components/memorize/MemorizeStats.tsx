"use client";

import { useMemo } from "react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { categoryCounts, type CardCategory } from "@/lib/srs/due";
import { boxDistribution, summary, dueForecast } from "@/lib/srs/stats";
import { BOX_INTERVALS } from "@/lib/srs/schedule";
import { activityHeatmap, currentStreak } from "@/lib/srs/activityLog";
import type { Deck, SrsSource } from "@/lib/srs/types";
import HelpTooltip from "./HelpTooltip";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };

const DECK_NAME_KEY: Record<Deck, string> = {
  all: "mem.deckAll",
  code: "mem.deckCode",
  text: "mem.deckText",
};

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
  // 제목은 선택 덱 반영 — "전체/코드 분석/글 분석 학습 통계".
  const title = `${t(DECK_NAME_KEY[deck])} ${t("mem.statsTitle")}`;

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
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("mem.statEmpty")}</p>
      </div>
    );
  }

  const boxMax = Math.max(1, ...boxes);
  const catTotal = CAT_META.reduce((n, c) => n + cats[c.key], 0);
  const fcMax = Math.max(1, ...forecast.map((f) => f.count));

  return (
    <div className="flex max-h-[calc(100vh-8rem)] flex-col gap-5 overflow-y-auto pr-1">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h2>

      {/* 상단 2단 — 좌: 총 카드 + 분류 도넛 / 우: 암기 단계 + 복습 예정 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 좌: 총 카드 + 분류 도넛 */}
        <div className="flex items-center gap-4">
          <div className="flex shrink-0 flex-col gap-0.5">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{t("mem.statTotal")}</span>
            <span className="text-4xl font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{sum.total}</span>
          </div>
          <div className="flex items-center gap-3">
            <Donut segments={CAT_META.map((c) => ({ value: cats[c.key], color: c.color }))} total={catTotal} size={104} stroke={13} />
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
        </div>

        {/* 우: 암기 단계 + 복습 예정 */}
        <div className="flex flex-col gap-5">
          <Section title={t("mem.statBoxDist")} help={t("mem.stageHelp")}>
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

          <Section title={t("mem.statForecast")}>
            <div className="flex items-end gap-2">
              {forecast.map((f, i) => {
                // "yyyy-mm-dd"를 로컬 날짜로 파싱(new Date(문자열)은 UTC라 음수 UTC서 요일 밀림).
                const [yy, mm, dd] = f.date.split("-").map(Number);
                const d = new Date(yy, mm - 1, dd);
                const label = i === 0 ? t("mem.today") : d.toLocaleDateString(LOCALE_TAG[locale] ?? "en-US", { weekday: "short" });
                const today = i === 0;
                return (
                  <div key={f.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className={`text-[10px] font-semibold tabular-nums ${today ? "text-blue-500 dark:text-blue-400" : f.count > 0 ? "text-zinc-500 dark:text-zinc-300" : "text-zinc-300 dark:text-zinc-600"}`}>
                      {f.count > 0 ? t("mem.statCount").replace("{n}", String(f.count)) : "·"}
                    </span>
                    {/* 고정 높이 트랙(%높이가 죽지 않게) + 옅은 배경 baseline */}
                    <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800/60">
                      <div
                        className={`w-full rounded-md transition-all ${today ? "bg-blue-500 dark:bg-blue-400" : "bg-blue-300 dark:bg-blue-600"}`}
                        style={{ height: `${f.count > 0 ? Math.max(10, (f.count / fcMax) * 100) : 0}%` }}
                      />
                    </div>
                    <span className={`text-[10px] ${today ? "font-semibold text-blue-500 dark:text-blue-400" : "text-zinc-400 dark:text-zinc-500"}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </div>

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

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {title}
        {help && <HelpTooltip text={help} align="left" />}
      </h3>
      {children}
    </div>
  );
}

// SVG 도넛 — stroke-dasharray 세그먼트. 데이터 없으면 회색 링. size/stroke 조절 가능.
function Donut({ segments, total, size = 72, stroke = 10 }: { segments: { value: number; color: string }[]; total: number; size?: number; stroke?: number }) {
  const cxy = size / 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={cxy} cy={cxy} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-zinc-100 dark:text-zinc-800" />
      {total > 0 &&
        segments.map((s, i) => {
          if (s.value === 0) return null;
          const len = (s.value / total) * c;
          const seg = (
            <circle
              key={i}
              cx={cxy}
              cy={cxy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
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
