// due 큐 셀렉터 + 덱 통계.

import { collectCards } from "./collect";
import { isDue } from "./schedule";
import { DECK_SOURCES } from "./types";
import type { Card, Deck, SrsSource } from "./types";

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
