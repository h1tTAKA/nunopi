// due 큐 셀렉터 + 덱 통계.

import { collectCards } from "./collect";
import { isDue } from "./schedule";
import { DECK_SOURCES } from "./types";
import type { Card, CardOrder, Deck, SrsSource } from "./types";

// 카드 분류 = 마지막 채점 등급, 채점 이력 없으면 "none"(미분류).
export type CardCategory = "again" | "hard" | "good" | "none";

export function cardCategory(card: Card): CardCategory {
  return card.state.lastGrade ?? "none";
}

// 선택된 분류만 남긴다(빈 선택이면 전체 통과 — 필터 없음).
export function filterByCategory(cards: Card[], selected: Set<CardCategory>): Card[] {
  if (selected.size === 0) return cards;
  return cards.filter((c) => selected.has(cardCategory(c)));
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
