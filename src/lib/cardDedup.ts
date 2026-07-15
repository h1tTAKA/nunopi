// 갤러리 카드 중복 정리 — 보유 카드 전체를 맥락으로 주고(chat 모드 재사용),
// 의미가 같은(near-duplicate) 카드 묶음을 ```card-dedup 블록으로 받아 파싱한다.
// deck-select(deckSelect.ts)와 같은 방식: agent lib/route/schema 무변경.
import type { Card } from "./srs/types";

// 에이전트가 찾은 중복 묶음 하나 — 카드 key 목록 + 왜 같은지 한 줄.
export interface DedupGroup {
  keys: string[];
  reason: string;
}

// 보유 카드 목록 + 규칙 → chat의 code(맥락) 슬롯 문자열.
export function buildDedupContext(cards: Card[]): string {
  const list = cards
    .map((c) => `${c.key} | ${c.front} | ${(c.back ?? "").replace(/\s+/g, " ").slice(0, 80)}`)
    .join("\n");
  return [
    "너는 사용자의 플래시카드 중에서 '의미가 같은(near-duplicate)' 카드를 찾아 묶는 조수다.",
    "아래는 사용자가 보유한 카드 전체 목록이다(key | 앞면(용어) | 뒷면(설명)).",
    "같은 개념을 이름만 다르게 적은 카드들을 한 그룹으로 묶어라. 예:",
    "  - '함수 컴포넌트' vs 'React 함수형 컴포넌트'",
    "  - 영어/한글 병기가 갈린 같은 용어('surrogate' vs '서러게이트')",
    "  - 표기·축약만 다른 동일 개념('useState 훅' vs 'useState')",
    "★ 보수적으로 판단하라. 표기가 비슷해도 의미가 다르면 묶지 마라(과묶음 금지).",
    "  헷갈리면 묶지 않는 쪽을 택한다. 확실히 같은 것만 묶어라.",
    "각 그룹은 반드시 카드 2장 이상이어야 하고, 왜 같은지 한 줄 이유(reason)를 붙여라.",
    "중복이 하나도 없으면 빈 배열을 출력하라.",
    "답변 맨 끝에 아래 형식 블록 **하나**로 모든 그룹을 배열로 담아라:",
    "```card-dedup",
    '[{"keys": ["source:term", "source:term"], "reason": "둘 다 X 개념을 가리킴"}]',
    "```",
    "key는 아래 목록의 key를 그대로 사용. 목록에 없는 key는 만들지 마라.",
    "",
    "보유 카드 (key | 용어 | 설명):",
    list,
  ].join("\n");
}

// 전역 — 응답에 블록이 여럿일 수 있어 모두 매칭.
const FENCE_G = /```card-dedup\s*([\s\S]*?)```/g;

// 응답 텍스트에서 중복 그룹 배열 추출(없거나 깨지면 빈 배열).
// 관대한 파싱: 블록 여럿 수용, 각 블록은 그룹 객체 배열. keys 2개 미만 그룹은 버린다.
export function parseDedupGroups(text: string): DedupGroup[] {
  const groups: DedupGroup[] = [];
  for (const m of text.matchAll(FENCE_G)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue; // 이 블록만 건너뜀
    }
    if (!Array.isArray(parsed)) continue;
    for (const g of parsed) {
      if (!g || typeof g !== "object") continue;
      const obj = g as { keys?: unknown; reason?: unknown };
      const keys = Array.isArray(obj.keys)
        ? [...new Set(obj.keys.filter((k): k is string => typeof k === "string" && k.length > 0))]
        : [];
      if (keys.length < 2) continue; // 중복 묶음은 2장 이상
      groups.push({ keys, reason: typeof obj.reason === "string" ? obj.reason : "" });
    }
  }
  return groups;
}

// 표시용 — 응답에서 card-dedup 블록(들)을 모두 떼어낸 자연어 본문.
export function stripDedup(text: string): string {
  return text.replace(FENCE_G, "").trim();
}

// 스트리밍 중 — 아직 닫히지 않았을 수 있는 블록을 끝에서 잘라 감춘다.
export function stripDedupStreaming(text: string): string {
  return text.replace(/```card-dedup[\s\S]*$/, "").trimEnd();
}
