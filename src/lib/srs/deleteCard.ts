// 카드 삭제 — 북마크 store에서 제거 + srs-state 정리 + 변경 이벤트 발행.
// 삭제하면 collectCards가 카드 목록에서 빼므로 사전·덱·갤러리에 자동 반영된다.
import { removeTokenDetail, removeConceptDetail, removeTermDetail } from "@/lib/bookmarkDetails";
import { CARDS_CHANGED_EVENT } from "@/lib/chatCard";
import { removeCardState } from "./store";
import type { Card } from "./types";

export function deleteCard(card: Card): void {
  // 스토어 키 = 용어 문자열(token=token / concept=title / term=term) = card.front.
  if (card.source === "token") removeTokenDetail(card.front);
  else if (card.source === "concept") removeConceptDetail(card.front);
  else removeTermDetail(card.front);
  removeCardState(card.key);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CARDS_CHANGED_EVENT));
}
