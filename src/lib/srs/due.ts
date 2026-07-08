// due 큐 셀렉터 + 덱 통계.

import { collectCards } from "./collect";
import { isDue } from "./schedule";
import { DECK_SOURCES } from "./types";
import type { Card, CardOrder, Deck, SrsSource } from "./types";

// 카드 분류 = 마지막 채점 등급(최신 기준), 채점 이력 없으면 "none"(미분류).
export type CardCategory = "again" | "hard" | "good" | "none";

export function cardCategory(card: Card): CardCategory {
  const s = card.state;
  if (s.lastGrade) return s.lastGrade; // 정확한 최신 등급(신규 데이터)
  // 하위호환 — lastGrade 없던 옛 데이터: streak/grades로 마지막 등급 추론.
  const g = s.grades;
  const reviews = s.reviews ?? 0;
  if (reviews === 0 || !g) return "none";
  if ((s.streak ?? 0) > 0) return "good"; // streak은 완벽에서만 증가 → 마지막은 완벽(확실)
  // streak 0 → 마지막은 다시/애매 중 하나. 카운트로 추정(둘 다면 더 많은 쪽, 동수는 다시).
  if (g.hard > 0 && g.again === 0) return "hard";
  if (g.again > 0 && g.hard === 0) return "again";
  if (g.again === 0 && g.hard === 0) return "good"; // 다시/애매 이력 없는데 streak0인 예외 → 완벽 취급
  return g.again >= g.hard ? "again" : "hard";
}

// 선택된 분류만 남긴다(빈 선택이면 전체 통과 — 필터 없음).
export function filterByCategory(cards: Card[], selected: Set<CardCategory>): Card[] {
  if (selected.size === 0) return cards;
  return cards.filter((c) => selected.has(cardCategory(c)));
}

// 덱의 분류별 카드 수(체크박스 배지용). due 무관 — 덱 전체 기준.
export function categoryCounts(deck: Deck, now: Date, sources?: SrsSource[]): Record<CardCategory, number> {
  const deckSources = DECK_SOURCES[deck];
  const effective = sources ? deckSources.filter((s) => sources.includes(s)) : deckSources;
  const counts: Record<CardCategory, number> = { again: 0, hard: 0, good: 0, none: 0 };
  for (const c of collectCards(effective, now)) counts[cardCategory(c)]++;
  return counts;
}

// 카드 제시 순서 적용. 최신순/과거순은 습득일(bookmarkedAt) 기준, 무작위는 Fisher-Yates.
export function orderCards(cards: Card[], order: CardOrder): Card[] {
  const arr = [...cards];
  if (order === "random") {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const dir = order === "newest" ? -1 : 1; // newest=최신 먼저(desc)
  return arr.sort((a, b) => dir * ((a.bookmarkedAt ?? "").localeCompare(b.bookmarkedAt ?? "")));
}

// 오늘(로컬 자정 기준) 복습 대상 카드.
export function dueCards(cards: Card[], now: Date): Card[] {
  return cards.filter((c) => isDue(c.state, now));
}

// 덱(+세부 출처 필터)의 오늘 due / 전체 카운트.
// sources 미지정 시 덱 전체 출처. sources 지정 시 덱∩sources.
export function deckStats(
  deck: Deck,
  now: Date,
  sources?: SrsSource[],
): { due: number; total: number } {
  const deckSources = DECK_SOURCES[deck];
  const effective = sources
    ? deckSources.filter((s) => sources.includes(s))
    : deckSources;
  const cards = collectCards(effective, now);
  return { due: dueCards(cards, now).length, total: cards.length };
}
