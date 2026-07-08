// 카드 수집기 — 북마크 store(token/concept/term)를 읽어 SRS 카드로 변환하고
// srs-state를 조인한다. 북마크는 언제든 추가/삭제되므로 카드 목록은 저장하지 않고
// 매번 store에서 파생한다(srs-state만 영속).

import {
  loadTokenDetails,
  loadConceptDetails,
  loadTermDetails,
} from "@/lib/bookmarkDetails";
import { initialState } from "./schedule";
import { loadSrsState } from "./store";
import type { Card, SrsSource } from "./types";

function cardKey(source: SrsSource, term: string): string {
  return `${source}:${term}`;
}

// 한 출처의 북마크 → 카드(앞=용어, 뒤=설명). 설명 없으면 빈 문자열.
function collectSource(source: SrsSource): { key: string; source: SrsSource; front: string; back: string; bookmarkedAt?: string; sourceTitle?: string; sourceId?: string }[] {
  if (source === "token") {
    return Object.values(loadTokenDetails()).map((t) => ({
      key: cardKey("token", t.token),
      source,
      front: t.token,
      back: t.description ?? "",
      bookmarkedAt: t.bookmarkedAt,
      sourceTitle: t.sourceTitle,
      sourceId: t.sourceId,
    }));
  }
  if (source === "concept") {
    return Object.values(loadConceptDetails()).map((c) => ({
      key: cardKey("concept", c.title),
      source,
      front: c.title,
      back: c.description ?? "",
      bookmarkedAt: c.bookmarkedAt,
      sourceTitle: c.sourceTitle,
      sourceId: c.sourceId,
    }));
  }
  // term — 글 IT용어 + 관련개념(asTerm 병합).
  return Object.values(loadTermDetails()).map((t) => ({
    key: cardKey("term", t.term),
    source,
    front: t.term,
    back: t.explanation ?? "",
    bookmarkedAt: t.bookmarkedAt,
    sourceTitle: t.sourceTitle,
    sourceId: t.sourceId,
  }));
}

// 주어진 출처들의 카드 목록 + srs-state 조인(없으면 box1 기본).
export function collectCards(sources: SrsSource[], now: Date): Card[] {
  const states = loadSrsState();
  const cards: Card[] = [];
  for (const source of sources) {
    for (const base of collectSource(source)) {
      cards.push({ ...base, state: states[base.key] ?? initialState(now) });
    }
  }
  return cards;
}
