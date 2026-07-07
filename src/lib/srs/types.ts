// 암기모드(플래시카드 SRS) 공통 타입.
// SRS = Spaced Repetition System. 북마크한 용어를 에빙하우스 망각곡선 기반
// 간격 반복(Leitner)으로 복습한다.

// 카드 출처 — 3개 북마크 store에 대응(관련개념은 저장 시 term에 병합됨).
export type SrsSource = "token" | "concept" | "term";

// 3단계 채점: 다시(강등) / 애매(유지) / 완벽(승급).
export type Grade = "again" | "hard" | "good";

// 덱 = 카드 묶음(북마크 출처 그룹). code=토큰+개념, text=글용어, all=전체.
export type Deck = "code" | "text" | "all";

// 카드 한 장의 복습 진도. 북마크 원본과 분리 저장(nunopi:srs-state).
export interface SrsState {
  box: number; // 1..5 (Leitner 박스)
  nextReviewAt: string; // ISO — 이 날(로컬 자정) 이후 복습 대상
  lastReviewedAt: string | null;
  streak: number; // 연속 "완벽" 횟수(통계용)
}

// 수집기가 북마크 store + srs-state를 조인해 만든 복습 카드.
export interface Card {
  key: string; // `${source}:${term}` — srs-state 맵의 키
  source: SrsSource;
  front: string; // 앞면(용어)
  back: string; // 뒷면(설명)
  state: SrsState;
}

// 덱 → 포함 출처.
export const DECK_SOURCES: Record<Deck, SrsSource[]> = {
  code: ["token", "concept"],
  text: ["term"],
  all: ["token", "concept", "term"],
};
