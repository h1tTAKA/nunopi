// 에이전트 자동 분류 — 보유 카드를 "이미 만들어진 덱" 중 어울리는 곳에 배정(chat 모드 재사용).
// 응답의 ```deck-assign``` 블록에서 {덱 이름 → 카드 key} 매핑을 파싱. deck-select/nunopi-cards와 펜스 분리.
import type { Card } from "./srs/types";
import type { ExistingDeck } from "./deckSelect";

// 에이전트가 낸 배정 하나 — 기존 덱 이름 + 그 덱에 넣을 카드 key들.
export interface DeckAssign {
  deck: string; // 기존 커스텀 덱 이름
  keys: string[];
}

// 보유 카드 + 기존 덱 목록 + 규칙 → chat의 code(맥락) 슬롯.
export function buildDeckAssignContext(cards: Card[], existingDecks: ExistingDeck[]): string {
  const list = cards
    .map((c) => `${c.key} | ${c.front} | ${(c.back ?? "").replace(/\s+/g, " ").slice(0, 40)}`)
    .join("\n");
  const deckLines = existingDecks.length > 0
    ? existingDecks.map((d) => `- ${d.name} (${d.cardKeys.length}장): ${d.cardKeys.join(", ")}`).join("\n")
    : "(없음)";
  return [
    "너는 사용자의 플래시카드를 '이미 만들어진 덱'에 분류해 넣는 조수다.",
    "사용자와 자유롭게 대화하며 어떤 카드를 어느 덱에 넣으면 좋을지 상담할 수 있다.",
    "사용자가 카드 분류를 원하면(예: '새 카드들 어울리는 덱에 넣어줘'), 각 카드를 아래 '이미 만들어진 덱' 중",
    "가장 어울리는 덱에 배정한다. 한 카드는 여러 덱에 들어갈 수 있다(주제·관점별 묶음). 어울리는 덱이 없으면 배정하지 마라.",
    "이미 그 덱에 들어 있는 카드는 다시 배정하지 마라(중복). 배정 결과는 답변 맨 끝에 아래 형식 블록으로 출력한다(실제 배정할 때만):",
    "```deck-assign",
    '[{"deck": "덱 이름(아래 목록의 이름 그대로)", "keys": ["source:term", "source:term"]}, {"deck": "다른 덱", "keys": ["source:term"]}]',
    "```",
    "deck은 아래 목록의 덱 이름을 그대로, key는 아래 카드 목록의 key를 그대로 사용. 단순 상담 답변엔 블록을 넣지 마라.",
    "",
    "이미 만들어진 덱 (이름 (장수): 포함 카드 key):",
    deckLines,
    "",
    "보유 카드 (key | 용어 | 설명):",
    list,
  ].join("\n");
}

const FENCE_G = /```deck-assign\s*([\s\S]*?)```/g;

// 응답에서 배정 배열 추출(없거나 깨지면 빈 배열). 블록 여럿이면 전부 모음.
export function parseDeckAssign(text: string): DeckAssign[] {
  const out: DeckAssign[] = [];
  for (const m of text.matchAll(FENCE_G)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const a of parsed) {
      if (!a || typeof a !== "object") continue;
      const obj = a as { deck?: unknown; keys?: unknown };
      const deck = typeof obj.deck === "string" ? obj.deck : "";
      const keys = Array.isArray(obj.keys)
        ? obj.keys.filter((k): k is string => typeof k === "string" && k.length > 0)
        : [];
      if (!deck || keys.length === 0) continue;
      out.push({ deck, keys });
    }
  }
  return out;
}

// 표시용 — 응답에서 deck-assign 블록(들)을 뗀 자연어 본문.
export function stripDeckAssign(text: string): string {
  return text.replace(FENCE_G, "").trim();
}

// 스트리밍 중 — 아직 안 닫힌 블록을 끝에서 잘라 감춘다.
export function stripDeckAssignStreaming(text: string): string {
  return text.replace(/```deck-assign[\s\S]*$/, "").trimEnd();
}
