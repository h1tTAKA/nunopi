"use client";

import { useMemo } from "react";
import { useT, useLocale } from "@/lib/i18n/I18nProvider";
import { categoryCounts, type CardCategory } from "@/lib/srs/due";
import { boxDistribution, summary, dueForecast } from "@/lib/srs/stats";
import { BOX_INTERVALS } from "@/lib/srs/schedule";
import type { Deck, SrsSource } from "@/lib/srs/types";
import HelpTooltip from "./HelpTooltip";
import ActivityHeatmap from "./ActivityHeatmap";
import MemorizeInsights from "./MemorizeInsights";

const LOCALE_TAG: Record<string, string> = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };

// 누노피 심볼 그라데이션(시안→블루→바이올렛). 막대 채움색으로 사용.
const BRAND_H = "linear-gradient(90deg, #22d3ee 0%, #3b82f6 55%, #8b5cf6 100%)"; // 가로 막대
const BRAND_V = "linear-gradient(0deg, #22d3ee 0%, #3b82f6 55%, #8b5cf6 100%)"; // 세로 막대(아래 시안→위 바이올렛)

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

  if (sum.total === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/40 p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("mem.statEmpty")}</p>
      </div>
    );
  }

  const boxMax = Math.max(1, ...boxes);
  const catTotal = CAT_META.reduce((n, c) => n + cats[c.key], 0);
  const fcMax = Math.max(1, ...forecast.map((f) => f.count));

  return (
    <div className="flex flex-col gap-3">
      {/* 학습 통계 패널 */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h2>

      {/* 상단 2단 — 좌: 총 카드 + 분류 도넛 / 우: 암기 단계 + 복습 예정 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 좌: 총 카드 + 분류 도넛 — 왼쪽 공간 채우게 크게 */}
        <div className="flex items-center justify-center gap-5">
          <div className="flex shrink-0 flex-col gap-1">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{t("mem.statTotal")}</span>
            <span className="text-5xl font-bold leading-none tabular-nums text-zinc-800 dark:text-zinc-100">{sum.total}</span>
          </div>
          <div className="flex items-center gap-4">
            <Donut segments={CAT_META.map((c) => ({ value: cats[c.key], color: c.color }))} total={catTotal} size={128} stroke={15} />
            <div className="flex flex-col gap-1.5">
              {CAT_META.map((c) => (
                <div key={c.key} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
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
                      className="h-full rounded transition-all"
                      style={{ width: `${(n / boxMax) * 100}%`, backgroundImage: BRAND_H }}
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
                    <span className={`text-[10px] font-semibold tabular-nums ${today ? "text-[#3B34E2] dark:text-[#8b86f5]" : f.count > 0 ? "text-zinc-500 dark:text-zinc-300" : "text-zinc-300 dark:text-zinc-600"}`}>
                      {f.count > 0 ? t("mem.statCount").replace("{n}", String(f.count)) : "·"}
                    </span>
                    {/* 고정 높이 트랙(%높이가 죽지 않게) + 옅은 배경 baseline */}
                    <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800/60">
                      <div
                        className={`w-full rounded-md transition-all ${today ? "" : "opacity-40"}`}
                        style={{ height: `${f.count > 0 ? Math.max(10, (f.count / fcMax) * 100) : 0}%`, backgroundImage: BRAND_V }}
                      />
                    </div>
                    <span className={`text-[10px] ${today ? "font-semibold text-[#3B34E2] dark:text-[#8b86f5]" : "text-zinc-400 dark:text-zinc-500"}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </div>
      </div>

      {/* 학습 활동 패널 (전역 — 모든 복습) */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/40 p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
        <ActivityHeatmap now={now} />
      </div>

      {/* 인사이트 위젯 (선택 덱 기준) */}
      <MemorizeInsights deck={deck} sources={sources} now={now} />
    </div>
  );
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

// SVG 도넛 — 연속 링 세그먼트(글로우/간격 없음).
function Donut({ segments, total, size = 72, stroke = 10 }: { segments: { value: number; color: string }[]; total: number; size?: number; stroke?: number }) {
  const cxy = size / 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={cxy} cy={cxy} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-zinc-200/70 dark:text-zinc-800" />
      {total > 0 &&
        segments.map((s, i) => {
          if (s.value === 0) return null;
          const len = (s.value / total) * c;
          const el = (
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
          return el;
        })}
    </svg>
  );
}
