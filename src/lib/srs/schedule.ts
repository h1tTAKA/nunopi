// Leitner 박스 스케줄러 — 채점(Grade)에 따라 박스 전이 + 다음 복습일 계산.
// 순수 함수(now 주입)로 테스트 용이.

import type { Grade, SrsState } from "./types";

// 박스 1..5의 복습 간격(일). box1=1일(매일) … box5=30일.
export const BOX_INTERVALS = [1, 3, 7, 14, 30];
export const MAX_BOX = BOX_INTERVALS.length;

// 로컬 자정으로 절삭 — "다음날" 비교를 시각 무관하게(에빙하우스 간격 직관).
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// 로컬 자정 + n일의 ISO.
function reviewDateISO(now: Date, days: number): string {
  const base = startOfLocalDay(now);
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

// 아직 srs-state가 없는 새 북마크의 기본 상태 — box1, 즉시 복습 대상.
export function initialState(now: Date): SrsState {
  return {
    box: 1,
    nextReviewAt: startOfLocalDay(now).toISOString(),
    lastReviewedAt: null,
    streak: 0,
  };
}

// 채점 → 다음 상태.
// again: box1 강등 / hard: 박스 유지 / good: 승급(최대 MAX_BOX).
export function applyGrade(state: SrsState, grade: Grade, now: Date): SrsState {
  // 손상 store 방어 — box를 항상 1..MAX_BOX로 클램프(BOX_INTERVALS[box-1] NaN 방지).
  let box = Math.min(MAX_BOX, Math.max(1, Math.round(state.box) || 1));
  if (grade === "again") box = 1;
  else if (grade === "good") box = Math.min(MAX_BOX, box + 1);
  // hard → 유지

  const interval = BOX_INTERVALS[box - 1];
  return {
    box,
    nextReviewAt: reviewDateISO(now, interval),
    lastReviewedAt: now.toISOString(),
    streak: grade === "good" ? state.streak + 1 : 0,
  };
}

// 오늘(로컬 자정 기준) 복습 대상인가.
export function isDue(state: SrsState, now: Date): boolean {
  const next = startOfLocalDay(new Date(state.nextReviewAt)).getTime();
  if (Number.isNaN(next)) return true; // 손상 날짜 → 안전하게 복습 대상으로(누락 방지).
  return next <= startOfLocalDay(now).getTime();
}
