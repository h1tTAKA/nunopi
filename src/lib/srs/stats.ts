// 학습 통계 셀렉터 — 현재 SrsState 기반(시계열 아님). 통계 패널용.
// deck+sources만 반영(세션의 mode/category 필터와 독립).

import { collectCards, collectCardsByKeys } from "./collect";
import { isDue, startOfLocalDay } from "./schedule";
import { DECK_SOURCES } from "./types";
import type { Deck, SrsSource } from "./types";
import { dayKey } from "./activityLog";

// 통계 대상 카드 — keys 주어지면 커스텀 덱(카드 key 목록), 아니면 덱 출처 기반.
function cardsOf(deck: Deck, now: Date, sources?: SrsSource[], keys?: string[]) {
  if (keys) return collectCardsByKeys(keys, now);
  const deckSources = DECK_SOURCES[deck];
  const effective = sources ? deckSources.filter((s) => sources.includes(s)) : deckSources;
  return collectCards(effective, now);
}

// Leitner 박스1~5 카드 수(인덱스 0=박스1). 성숙도 분포.
export function boxDistribution(deck: Deck, now: Date, sources?: SrsSource[], keys?: string[]): number[] {
  const dist = [0, 0, 0, 0, 0];
  for (const c of cardsOf(deck, now, sources, keys)) {
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
  keys?: string[],
): { again: number; hard: number; good: number; total: number; accuracy: number } {
  let again = 0, hard = 0, good = 0;
  for (const c of cardsOf(deck, now, sources, keys)) {
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
  keys?: string[],
): { date: string; count: number }[] {
  const today = startOfLocalDay(now).getTime();
  const buckets: { date: string; count: number }[] = [];
  const dayMs = 86400000;
  for (let i = 0; i < days; i++) {
    const d = new Date(today + i * dayMs);
    buckets.push({ date: dayKey(d), count: 0 });
  }
  const lastDay = today + (days - 1) * dayMs;
  for (const c of cardsOf(deck, now, sources, keys)) {
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
  keys?: string[],
): { total: number; due: number; accuracy: number; reviews: number } {
  const cards = cardsOf(deck, now, sources, keys);
  const due = cards.filter((c) => isDue(c.state, now)).length;
  const { accuracy } = gradeTotals(deck, now, sources, keys);
  const reviews = cards.reduce((n, c) => n + (c.state.reviews ?? 0), 0);
  return { total: cards.length, due, accuracy, reviews };
}

// --- 인사이트 위젯용 셀렉터 ---

export interface CardBrief {
  key: string;
  source: SrsSource;
  front: string;
  back: string; // 설명 — 인사이트 항목 클릭 시 날아오는 카드 면에 표시
  again: number;
  hard: number;
  good: number;
  box: number;
  bookmarkedAt?: string;
  nextReviewAt: string;
}

function brief(c: ReturnType<typeof cardsOf>[number]): CardBrief {
  const g = c.state.grades ?? { again: 0, hard: 0, good: 0 };
  return {
    key: c.key, source: c.source, front: c.front, back: c.back,
    again: g.again, hard: g.hard, good: g.good,
    box: c.state.box, bookmarkedAt: c.bookmarkedAt, nextReviewAt: c.state.nextReviewAt,
  };
}

// 자주 틀리는 카드 — 다시 많은 순, 동률(또는 다시 0)이면 애매 많은 순. 채점 이력 있는 것만.
export function weakestCards(deck: Deck, now: Date, sources: SrsSource[] | undefined, limit = 4, keys?: string[]): CardBrief[] {
  return cardsOf(deck, now, sources, keys)
    .map(brief)
    .filter((c) => c.again + c.hard > 0)
    .sort((a, b) => b.again - a.again || b.hard - a.hard) // 다시 우선, 동률이면 애매 순
    .slice(0, limit);
}

// 최근 추가한 카드 — bookmarkedAt 최신순.
export function recentlyAddedCards(deck: Deck, now: Date, sources: SrsSource[] | undefined, limit = 4, keys?: string[]): CardBrief[] {
  return cardsOf(deck, now, sources, keys)
    .map(brief)
    .filter((c) => !!c.bookmarkedAt)
    .sort((a, b) => (b.bookmarkedAt ?? "").localeCompare(a.bookmarkedAt ?? ""))
    .slice(0, limit);
}

// 곧 복습 예정 — nextReviewAt이 오늘 이후(미래)인 것만 가까운 순(due 지난 건 제외).
export function upcomingCards(deck: Deck, now: Date, sources: SrsSource[] | undefined, limit = 4, keys?: string[]): CardBrief[] {
  const today = startOfLocalDay(now).getTime();
  return cardsOf(deck, now, sources, keys)
    .map(brief)
    .filter((c) => {
      const t = startOfLocalDay(new Date(c.nextReviewAt)).getTime();
      return !Number.isNaN(t) && t > today;
    })
    .sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime())
    .slice(0, limit);
}

// 덱별 성숙도 — code/text 각 총수 + 성숙(box≥4) 수.
export function deckMaturity(now: Date): { deck: "code" | "text"; total: number; mature: number }[] {
  return (["code", "text"] as const).map((deck) => {
    const cards = cardsOf(deck, now);
    return { deck, total: cards.length, mature: cards.filter((c) => c.state.box >= 4).length };
  });
}
