// 에이전트 덱 커스터마이징 — 보유 카드 컨텍스트 + 규칙을 만들고(chat 모드 재사용),
// 응답에서 제안 덱 배열(```deck-select 블록)을 파싱. 대화형(상담 + 필요 시 복수 덱 제안).
import type { Card } from "./srs/types";

// 에이전트가 제안하는 덱 하나 — 제목 + 카드 key 목록.
export interface DeckProposal {
  name: string;
  keys: string[];
}

// 이미 만들어진 커스텀 덱(겹침 회피 참고용).
export interface ExistingDeck {
  name: string;
  cardKeys: string[];
}

// 보유 카드 목록 + 기존 덱 + 에이전트 역할/규칙 → chat의 code(맥락) 슬롯에 넣는다.
export function buildDeckSelectContext(cards: Card[], existingDecks: ExistingDeck[] = []): string {
  const list = cards
    .map((c) => `${c.key} | ${c.front} | ${(c.back ?? "").replace(/\s+/g, " ").slice(0, 120)}`)
    .join("\n");
  const deckLines = existingDecks.length > 0
    ? existingDecks.map((d) => `- ${d.name} (${d.cardKeys.length}장): ${d.cardKeys.join(", ")}`).join("\n")
    : "(없음)";
  return [
    "너는 사용자의 플래시카드 '덱' 구성을 돕는 조수다. 아래는 사용자가 보유한 카드 전체 목록이다.",
    "사용자와 자유롭게 대화하며 어떤 기준으로 덱을 나누면 좋을지 제안·상담할 수 있다.",
    "사용자가 덱을 만들고 싶어 하면(예: '타입스크립트 덱 만들어줘'), 하나 또는 여러 개의 덱으로 나눠",
    "각 덱에 알맞은 제목을 붙이고, 그 덱에 맞는 카드의 key들을 답변 맨 끝에 아래 형식 블록으로 출력한다",
    "(덱을 실제로 구성할 때만). 주제가 넓으면 여러 덱으로 쪼개도 좋다.",
    "한 카드는 여러 덱에 동시에 속할 수 있다(덱은 '주제·관점별 묶음'이라 같은 카드를 다른 목적의 덱에 재사용해도 된다).",
    "사용자가 '기존과 겹치지 않게'라고 하면, 이미 쓰인 카드를 배제하라는 뜻이 아니라 아래 '이미 만들어진 덱'과 같은 주제·구성을 반복하지 말라는 뜻이다.",
    "따라서 보유 카드가 모두 어떤 덱에 들어가 있어도, 다른 관점으로 새 덱을 얼마든지 제안할 수 있다(되묻지 말고 바로 제안).",
    "★ 중요: 덱이 여러 개여도 반드시 ```deck-select``` 블록 **하나**에 모든 덱을 배열로 담아라(덱마다 블록을 따로 만들지 마라):",
    "```deck-select",
    '[{"name": "덱 제목", "keys": ["source:term", "source:term"]}, {"name": "다른 덱", "keys": ["source:term"]}]',
    "```",
    "key는 아래 목록의 key를 그대로 사용. 단순 상담·제안 답변에는 블록을 넣지 마라.",
    "",
    "이미 만들어진 덱(겹치지 않게 제안할 때 참고):",
    deckLines,
    "",
    "보유 카드 (key | 용어 | 설명):",
    list,
  ].join("\n");
}

// 전역 — 응답에 deck-select 블록이 여럿일 수 있어(에이전트가 덱마다 따로 내기도 함) 모두 매칭.
const FENCE_G = /```deck-select\s*([\s\S]*?)```/g;

// 응답 텍스트에서 제안 덱 배열 추출(없거나 깨지면 빈 배열).
// 관대한 파싱: (1) 블록이 여럿이면 전부 모으고, (2) 각 블록은 덱 객체 배열 | 문자열 key 배열(1덱) 수용.
export function parseDeckSelect(text: string): DeckProposal[] {
  const decks: DeckProposal[] = [];
  for (const m of text.matchAll(FENCE_G)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue; // 이 블록만 건너뜀(다른 블록은 계속)
    }
    if (!Array.isArray(parsed)) continue;
    // 문자열 배열 블록 → 이름 없는 덱 하나로 흡수.
    if (parsed.every((x) => typeof x === "string")) {
      const keys = (parsed as string[]).filter((k) => k.length > 0);
      if (keys.length > 0) decks.push({ name: "", keys });
      continue;
    }
    // 덱 객체 배열 블록.
    for (const d of parsed) {
      if (!d || typeof d !== "object") continue;
      const obj = d as { name?: unknown; keys?: unknown };
      const keys = Array.isArray(obj.keys)
        ? obj.keys.filter((k): k is string => typeof k === "string" && k.length > 0)
        : [];
      if (keys.length === 0) continue;
      decks.push({ name: typeof obj.name === "string" ? obj.name : "", keys });
    }
  }
  return decks;
}

// 표시용 — 응답에서 deck-select 블록(들)을 모두 떼어낸 자연어 본문.
export function stripDeckSelect(text: string): string {
  return text.replace(FENCE_G, "").trim();
}

// 스트리밍 중 — 아직 닫히지 않았을 수 있는 deck-select 블록을 끝에서 잘라 감춘다.
export function stripDeckSelectStreaming(text: string): string {
  return text.replace(/```deck-select[\s\S]*$/, "").trimEnd();
}
