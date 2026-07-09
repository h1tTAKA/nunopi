// 카드 "출처로 이동" 가능 여부 — 출처 종류별.
// analysis: 그 분석 히스토리가 아직 존재할 때. card: 생성처 카드 key가 있을 때.
import type { Card } from "./types";

export function canGoToSource(card: Card, sourceIds: Set<string>): boolean {
  if (card.sourceKind === "card") return !!card.originCardKey;
  return !!card.sourceId && sourceIds.has(card.sourceId);
}
