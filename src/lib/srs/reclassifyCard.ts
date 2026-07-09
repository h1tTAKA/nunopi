// 카드 분류(출처 종류) 변경 — 카드를 다른 북마크 store로 이동.
// key(`${source}:${term}`)가 바뀌므로 srs-state도 새 key로 이관해 진척(box/streak/reviews) 보존.
import {
  removeTokenDetail, removeConceptDetail, removeTermDetail,
  putTokenDetail, putConceptDetail, putTermDetail,
  type SourceFields,
} from "@/lib/bookmarkDetails";
import { CARDS_CHANGED_EVENT } from "@/lib/chatCard";
import { loadSrsState, updateCardState, removeCardState } from "./store";
import type { Card, SrsSource } from "./types";

export function reclassifyCard(card: Card, next: SrsSource): boolean {
  if (next === card.source) return false;
  const front = card.front;
  const oldKey = card.key;
  const newKey = `${next}:${front}`;
  // 진척 보존용 — 이관 전에 읽어둔다.
  const state = loadSrsState()[oldKey];
  // 보존할 공통 출처/습득 필드.
  const carry: SourceFields & { bookmarkedAt: string } = {
    bookmarkedAt: card.bookmarkedAt ?? new Date().toISOString(),
    sourceTitle: card.sourceTitle,
    sourceId: card.sourceId,
    sourceKind: card.sourceKind,
    sourceSessionId: card.sourceSessionId,
    originCardKey: card.originCardKey,
  };
  // 옛 store·상태 제거.
  if (card.source === "token") removeTokenDetail(front);
  else if (card.source === "concept") removeConceptDetail(front);
  else removeTermDetail(front);
  removeCardState(oldKey);
  // 새 store에 최소 detail 기록(보존 필드 포함).
  if (next === "token") putTokenDetail({ id: `re:${front}`, token: front, category: "keyword", label: front, description: card.back, lines: [], bookmarkable: true, ...carry });
  else if (next === "term") putTermDetail({ id: `re:${front}`, term: front, explanation: card.back, conceptIds: [], bookmarkable: true, ...carry });
  else putConceptDetail({ conceptId: `re:${front}`, title: front, description: card.back, ...carry });
  // srs-state 이관(진척 보존).
  if (state) updateCardState(newKey, state);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CARDS_CHANGED_EVENT));
  return true;
}
