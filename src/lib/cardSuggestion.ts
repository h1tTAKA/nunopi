// 학습 챗 답변에 에이전트가 붙이는 카드 제안 블록(```nunopi-cards) 파싱/제거 유틸.
// provider 무관 텍스트 규약 — 답변 끝 펜스 블록의 JSON 배열을 읽어 "카드로 추가" 칩으로 노출.

export type SuggestKind = "token" | "concept" | "term";

export interface SuggestedCard {
  term: string;
  definition: string;
  kind?: SuggestKind; // 힌트 — 최종 저장 위치는 챗 위치로 결정(클라).
}

// 닫힌 nunopi-cards 블록(완성). 스트리밍 중 미완 블록은 stripStreamingCardBlock로 처리.
const FENCE = /```nunopi-cards\s*([\s\S]*?)```/;

function asKind(v: unknown): SuggestKind | undefined {
  return v === "token" || v === "concept" || v === "term" ? v : undefined;
}

// 어시스턴트 텍스트에서 카드 블록을 떼어낸 본문 + 파싱된 카드 목록.
export function parseCardSuggestions(content: string): { text: string; cards: SuggestedCard[] } {
  const m = content.match(FENCE);
  if (!m) return { text: content, cards: [] };
  let cards: SuggestedCard[] = [];
  try {
    const arr = JSON.parse(m[1].trim());
    if (Array.isArray(arr)) {
      cards = arr
        .filter((c): c is { term: unknown; definition?: unknown; kind?: unknown } => !!c && typeof (c as { term?: unknown }).term === "string")
        .map((c) => ({
          term: String(c.term).trim(),
          definition: String(c.definition ?? "").trim(),
          kind: asKind(c.kind),
        }))
        .filter((c) => c.term.length > 0);
    }
  } catch {
    /* 형식 깨진 블록 — 카드 없음으로 */
  }
  return { text: content.replace(FENCE, "").trimEnd(), cards };
}

// 블록 전체 제거(거절).
export function stripCardBlock(content: string): string {
  return content.replace(FENCE, "").trimEnd();
}

// 특정 term 카드만 블록에서 제거 → 남으면 블록 재작성, 없으면 블록 삭제(추가 후 갱신).
export function removeSuggestedCard(content: string, term: string): string {
  const { text, cards } = parseCardSuggestions(content);
  const rest = cards.filter((c) => c.term !== term);
  if (rest.length === 0) return text;
  return `${text}\n\n\`\`\`nunopi-cards\n${JSON.stringify(rest)}\n\`\`\``;
}

// 스트리밍 표시용 — 아직 닫히지 않았을 수 있는 블록을 답변 끝에서 잘라 감춘다.
export function stripStreamingCardBlock(content: string): string {
  return content.replace(/```nunopi-cards[\s\S]*$/, "").trimEnd();
}
