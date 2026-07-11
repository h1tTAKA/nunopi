// 카드 얼굴 이중 프레임 색 — 출처(분류)별 시각 구분.
// token=코드 토큰(emerald) / concept=프로그래밍 개념(amber) / term=IT용어·개념(blue).
// Tailwind JIT가 purge하지 못하도록 반드시 완성된 리터럴 클래스만 반환(동적 문자열 금지).
import type { SrsSource } from "./types";

const FRAME: Record<SrsSource, { outer: string; inner: string }> = {
  token: { outer: "border-emerald-500/60", inner: "border-emerald-500/35" },
  concept: { outer: "border-amber-500/60", inner: "border-amber-500/35" },
  term: { outer: "border-blue-500/60", inner: "border-blue-500/35" },
};

export function cardFrame(source: SrsSource): { outer: string; inner: string } {
  return FRAME[source];
}
