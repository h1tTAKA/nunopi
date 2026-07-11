// 에이전트 덱 커스터마이징 — 보유 카드 컨텍스트 + 규칙을 만들고(chat 모드 재사용),
// 응답에서 제안 덱 배열(```deck-select 블록)을 파싱. 대화형(상담 + 필요 시 복수 덱 제안).
import type { Card } from "./srs/types";

// 에이전트가 제안하는 덱 하나 — 제목 + 카드 key 목록.
export interface DeckProposal {
  name: string;
  keys: string[];
}

// 보유 카드 목록 + 에이전트 역할/규칙 → chat의 code(맥락) 슬롯에 넣는다.
export function buildDeckSelectContext(cards: Card[]): string {
  const list = cards
    .map((c) => `${c.key} | ${c.front} | ${(c.back ?? "").replace(/\s+/g, " ").slice(0, 120)}`)
    .join("\n");
  return [
    "너는 사용자의 플래시카드 '덱' 구성을 돕는 조수다. 아래는 사용자가 보유한 카드 전체 목록이다.",
    "사용자와 자유롭게 대화하며 어떤 기준으로 덱을 나누면 좋을지 제안·상담할 수 있다.",
    "사용자가 덱을 만들고 싶어 하면(예: '타입스크립트 덱 만들어줘'), 하나 또는 여러 개의 덱으로 나눠",
    "각 덱에 알맞은 제목을 붙이고, 그 덱에 맞는 카드의 key들을 답변 맨 끝에 아래 형식 블록으로 출력한다",
    "(덱을 실제로 구성할 때만). 주제가 넓으면 여러 덱으로 쪼개 제안해도 좋다:",
    "```deck-select",
    '[{"name": "덱 제목", "keys": ["source:term", "source:term"]}, {"name": "다른 덱", "keys": ["source:term"]}]',
    "```",
    "key는 아래 목록의 key를 그대로 사용. 단순 상담·제안 답변에는 블록을 넣지 마라.",
    "",
    "보유 카드 (key | 용어 | 설명):",
    list,
  ].join("\n");
}

const FENCE = /```deck-select\s*([\s\S]*?)```/;

// 응답 텍스트에서 제안 덱 배열 추출(없거나 깨지면 빈 배열).
// 관대한 파싱: 덱 객체 배열 | 문자열 key 배열(하위호환, 1덱) 모두 수용.
export function parseDeckSelect(text: string): DeckProposal[] {
  const m = text.match(FENCE);
  if (!m) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1].trim());
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  // 문자열 배열 → 이름 없는 단일 덱으로 흡수.
  if (parsed.every((x) => typeof x === "string")) {
    const keys = (parsed as string[]).filter((k) => k.length > 0);
    return keys.length > 0 ? [{ name: "", keys }] : [];
  }
  // 덱 객체 배열.
  const decks: DeckProposal[] = [];
  for (const d of parsed) {
    if (!d || typeof d !== "object") continue;
    const obj = d as { name?: unknown; keys?: unknown };
    const keys = Array.isArray(obj.keys)
      ? obj.keys.filter((k): k is string => typeof k === "string" && k.length > 0)
      : [];
    if (keys.length === 0) continue;
    decks.push({ name: typeof obj.name === "string" ? obj.name : "", keys });
  }
  return decks;
}

// 표시용 — 응답에서 deck-select 블록을 떼어낸 자연어 본문.
export function stripDeckSelect(text: string): string {
  return text.replace(FENCE, "").trim();
}

// 스트리밍 중 — 아직 닫히지 않았을 수 있는 deck-select 블록을 끝에서 잘라 감춘다.
export function stripDeckSelectStreaming(text: string): string {
  return text.replace(/```deck-select[\s\S]*$/, "").trimEnd();
}
