// 학습 통계 셀렉터 — 현재 SrsState 기반(시계열 아님). 통계 패널용.
// deck+sources만 반영(세션의 mode/category 필터와 독립).

import { collectCards } from "./collect";
import { isDue, startOfLocalDay } from "./schedule";
import { DECK_SOURCES } from "./types";
import type { Deck, SrsSource } from "./types";
import { dayKey } from "./activityLog";

function cardsOf(deck: Deck, now: Date, sources?: SrsSource[]) {
  const deckSources = DECK_SOURCES[deck];
  const effective = sources ? deckSources.filter((s) => sources.includes(s)) : deckSources;
  return collectCards(effective, now);
}

// Leitner 박스1~5 카드 수(인덱스 0=박스1). 성숙도 분포.
export function boxDistribution(deck: Deck, now: Date, sources?: SrsSource[]): number[] {
  const dist = [0, 0, 0, 0, 0];
  for (const c of cardsOf(deck, now, sources)) {
    const b = Math.min(5, Math.max(1, c.state.box)); // 방어적 클램프
    dist[b - 1]++;
  }
  return dist;
}

// 채점 등급 누적 합 + 정답률(good/전체). 채점 이력 없으면 0.
export function gradeTotals(
  deck: Deck,
  now: Date,
  sources?: SrsSource[],
): { again: number; hard: number; good: number; total: number; accuracy: number } {
  let again = 0, hard = 0, good = 0;
  for (const c of cardsOf(deck, now, sources)) {
    const g = c.state.grades;
    if (!g) continue;
    again += g.again; hard += g.hard; good += g.good;
  }
  const total = again + hard + good;
  return { again, hard, good, total, accuracy: total > 0 ? good / total : 0 };
}

// 총 복습 횟수(reviews 합).
export function reviewsTotal(deck: Deck, now: Date, sources?: SrsSource[]): number {
  let n = 0;
  for (const c of cardsOf(deck, now, sources)) n += c.state.reviews ?? 0;
  return n;
}

// N일 복습 예보 — 오늘~+{days-1}일 각 날짜에 "새로 due 도래"하는 카드 수(누적 아님).
// 각 카드는 nextReviewAt이 속한 하루에만 카운트. 이미 지난(오늘 이전) due는 오늘 칸에 합산.
export function dueForecast(
  deck: Deck,
  now: Date,
  sources?: SrsSource[],
  days = 7,
): { date: string; count: number }[] {
  const today = startOfLocalDay(now).getTime();
  const buckets: { date: string; count: number }[] = [];
  const dayMs = 86400000;
  for (let i = 0; i < days; i++) {
    const d = new Date(today + i * dayMs);
    buckets.push({ date: dayKey(d), count: 0 });
  }
  const lastDay = today + (days - 1) * dayMs;
  for (const c of cardsOf(deck, now, sources)) {
    const next = startOfLocalDay(new Date(c.state.nextReviewAt)).getTime();
    if (Number.isNaN(next)) continue;
    if (next <= today) { buckets[0].count++; continue; } // 오늘 이전/오늘 도래 → 오늘 칸
    if (next > lastDay) continue; // 예보 범위 밖
    const idx = Math.round((next - today) / dayMs);
    if (idx >= 0 && idx < days) buckets[idx].count++;
  }
  return buckets;
}

// 요약 — 총 카드 · 오늘 due · 정답률 · 총 복습.
export function summary(
  deck: Deck,
  now: Date,
  sources?: SrsSource[],
): { total: number; due: number; accuracy: number; reviews: number } {
  const cards = cardsOf(deck, now, sources);
  const due = cards.filter((c) => isDue(c.state, now)).length;
  const { accuracy } = gradeTotals(deck, now, sources);
  const reviews = cards.reduce((n, c) => n + (c.state.reviews ?? 0), 0);
  return { total: cards.length, due, accuracy, reviews };
}
