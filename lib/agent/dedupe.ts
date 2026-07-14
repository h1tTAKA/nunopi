import type { CodeToken, ConceptOccurrence, TokenCategory } from "@/lib/translator/types";

// LLM 출력은 같은 토큰/개념을 중복해 담을 수 있다. React key·DOM id 충돌과
// 중복 카드 표시를 막기 위해 식별자 기준으로 첫 항목만 남기고 제거한다.

const TOKEN_CATEGORIES: ReadonlySet<string> = new Set<TokenCategory>([
  "react_hook", "state_variable", "state_setter", "prop", "function",
  "event_handler", "jsx_element", "operator", "keyword", "punctuation",
  "api_call", "dependency_array", "initial_value", "css_selector",
  "css_property", "css_value", "tailwind_utility", "tailwind_layout",
  "tailwind_spacing", "tailwind_color", "tailwind_responsive", "tailwind_state",
]);

// 모델이 낸 토큰 객체(id·bookmarkable 없음)를 CodeToken으로 보정한다(#505). 모델엔
// token/category/label/description/lines만 요구하고, id(=token 텍스트)·bookmarkable(true)은
// 여기서 백필한다. 필수 필드가 없거나 형이 틀리면 그 항목만 버린다.
export function coerceModelTokens(raw: unknown): CodeToken[] {
  if (!Array.isArray(raw)) return [];
  const out: CodeToken[] = [];
  for (const v of raw) {
    if (typeof v !== "object" || v === null) continue;
    const r = v as Record<string, unknown>;
    const token = typeof r.token === "string" ? r.token.trim() : "";
    if (!token) continue;
    if (typeof r.label !== "string" || typeof r.description !== "string") continue;
    const lines = Array.isArray(r.lines)
      ? r.lines.filter((n): n is number => typeof n === "number")
      : [];
    const category = (typeof r.category === "string" && TOKEN_CATEGORIES.has(r.category)
      ? r.category
      : "keyword") as TokenCategory;
    out.push({
      id: token,
      token,
      category,
      label: r.label,
      description: r.description,
      example: typeof r.example === "string" ? r.example : undefined,
      lines,
      conceptId: typeof r.conceptId === "string" ? r.conceptId : undefined,
      bookmarkable: true,
    });
  }
  return out;
}

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
