import type { CodeToken, ConceptOccurrence } from "@/lib/translator/types";

// LLM 출력은 같은 토큰/개념을 중복해 담을 수 있다. React key·DOM id 충돌과
// 중복 카드 표시를 막기 위해 식별자 기준으로 첫 항목만 남기고 제거한다.

export function dedupeTokens(tokens: CodeToken[]): CodeToken[] {
  const seen = new Set<string>();
  return tokens.filter((token) => {
    if (seen.has(token.id)) return false;
    seen.add(token.id);
    return true;
  });
}

export function dedupeConcepts(concepts: ConceptOccurrence[]): ConceptOccurrence[] {
  const seen = new Set<string>();
  return concepts.filter((concept) => {
    if (seen.has(concept.conceptId)) return false;
    seen.add(concept.conceptId);
    return true;
  });
}
