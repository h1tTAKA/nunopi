// 에이전트 덱 커스터마이징 — 목표 + 전체 카드 목록으로 프롬프트를 만들고,
// 응답에서 고른 카드 key 배열(```deck-select 블록)을 파싱. 백엔드 무변경(chat 모드 재사용).
import type { Card } from "./srs/types";

// 목표 + 카드 목록(key | 용어 | 설명 요약) → chat 메시지 본문.
export function buildDeckSelectPrompt(goal: string, cards: Card[]): string {
  const list = cards
    .map((c) => `${c.key} | ${c.front} | ${(c.back ?? "").replace(/\s+/g, " ").slice(0, 120)}`)
    .join("\n");
  return [
    `사용자 목표: ${goal}`,
    "",
    "아래 카드들 중 이 목표 학습에 적합한 카드만 골라줘. 한 줄 설명 뒤,",
    "반드시 답변 맨 끝에 아래 형식 블록으로 고른 카드의 key 배열만 출력해(그 외 텍스트 금지):",
    "```deck-select",
    '["source:term", "source:term", ...]',
    "```",
    "key는 아래 목록에 있는 key를 그대로 사용. 적합한 카드가 없으면 빈 배열 [].",
    "",
    "카드 목록 (key | 용어 | 설명):",
    list,
  ].join("\n");
}

const FENCE = /```deck-select\s*([\s\S]*?)```/;

// 응답 텍스트에서 고른 카드 key 배열 추출. 형식 깨지면 빈 배열.
export function parseDeckSelect(text: string): string[] {
  const m = text.match(FENCE);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[1].trim());
    return Array.isArray(arr) ? arr.filter((k): k is string => typeof k === "string" && k.length > 0) : [];
  } catch {
    return [];
  }
}
