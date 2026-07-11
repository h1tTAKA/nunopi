// 카드 얼굴 이중 프레임 색 — 출처(분류)별 시각 구분.
// token=코드 토큰(violet) / concept=프로그래밍 개념(lime — 질문 버튼 색) / term=IT용어·개념(blue).
// concept은 질문(챗) 버튼과 같은 lime-600으로 앱 톤 통일.
// Tailwind JIT가 purge하지 못하도록 반드시 완성된 리터럴 클래스만 반환(동적 문자열 금지).
import type { SrsSource } from "./types";

const FRAME: Record<SrsSource, { outer: string; inner: string }> = {
  token: { outer: "border-violet-500/60", inner: "border-violet-500/35" },
  concept: { outer: "border-lime-500/80", inner: "border-lime-500/45" },
  term: { outer: "border-blue-500/80", inner: "border-blue-500/45" },
};

export function cardFrame(source: SrsSource): { outer: string; inner: string } {
  return FRAME[source];
}
