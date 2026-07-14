// 병렬 청크(2단계) 코드 분석용 프롬프트 지시문. claude/codex/openai 코드 모드
// buildPrompt가 공유한다. request 플래그에 따라 "줄설명 지시" 부분만 교체한다.
// - outlineOnly: 1차. 개념/요약/제목만, 줄설명 비움.
// - lineRange: 2차. 그 범위 줄설명만, 개념은 비우고 1차 개념 id만 참조.
// - 둘 다 아니면: 기존 전체 분석.
import type { AgentAnalyzeRequest } from "./schema";

// 줄별 설명(explanation)의 공통 형식 지시. 누노피 타깃(비개발자 바이브코더·주니어)이
// 한 줄 한 줄 이해하도록: 한 문장 퉁 금지, 쉬운말 요약 + 코드 조각별 풀이(마크다운, #503).
// full/lineRange 두 분기가 공유한다. 출력 언어는 분석 언어를 따른다(별도 지시).
const EXPLANATION_FORMAT: string[] = [
  "Each `explanation` is for a NON-DEVELOPER reader (a beginner / vibe-coder / junior). Do NOT gloss the whole line with a single terse sentence. Write it as MARKDOWN with two parts:",
  "(1) A plain-language summary (1-2 sentences) of WHAT this line does and WHY, in everyday words. Avoid unexplained jargon — if a technical term is unavoidable, immediately explain it in plain words a non-programmer understands.",
  "(2) Then a markdown bullet list (each line starting with '- ') that breaks down EVERY meaningful part of the line: put the exact code piece in `backticks`, then ' — ', then its meaning in plain language. Cover keywords, identifiers, types, AND symbols/operators too (e.g. `=`, `{ }`, `=>`, `?`, `:`). Assume the reader knows nothing about programming.",
  "For a ternary / conditional expression `A ? B : C`, do NOT label `?` and `:` as separate meaningless symbols — explain the whole expression together in plain words, e.g. 'if A is true, use B; otherwise use C', and say what A, B, C are here. Do the same for other multi-part operators (`&&`, `||`, `??`, `?.`): explain what the combination actually does, not just the symbol.",
  "Be concrete and genuinely helpful, not padded with filler. Write the whole explanation in the analysis output language.",
];

// 범용 토큰 추출 지시. 코드 전체에서 "어디서나 통용되는" 기초 토큰만 뽑아 tokens[]에 담는다
// (#505). 유저가 지어낸 이름(커스텀 함수/변수/타입/prop)은 재사용성이 없어 학습에 방해 →
// 제외. outlineOnly(청크 1차, 전체 코드)와 full(비청크)에서만 추출한다.
const TOKEN_EXTRACT: string[] = [
  "Also fill a `tokens` array with the UNIVERSAL, reusable tokens that ACTUALLY APPEAR in this code — things that mean the same in any codebase and are worth a beginner learning once: operators (`=`, `===`, `!`, `?`, `:`, `=>`, `&&`, `||`, `??`, `?.`, `...`), keywords (`const`, `let`, `function`, `return`, `export default`, `void`, `async`, `await`), built-in types (`boolean`, `string`, `number`), built-in/runtime APIs, hooks and common methods (`useState`, `useMemo`, `useEffect`, `map`, `filter`, `reduce`), and DOM/JSX basics (`className`, `<button>`, `<div>`, event params like `e`).",
  "Do NOT include names the author made up for THIS project — custom function/variable/type/prop names (e.g. `CardSession`, `CardSessionProps`, `sources`, `setClick`, `TONES`). They are not reused elsewhere, so listing them only distracts a learner. When unsure, ask: 'would this exact token appear, meaning the same thing, in a totally different project?' — if no, skip it.",
  "Each token object: { token (the exact text), category (one of: react_hook, state_variable, state_setter, prop, function, event_handler, jsx_element, operator, keyword, punctuation, api_call, dependency_array, initial_value), label (a short name), description (a short plain-language meaning for a non-developer), example (optional), lines (the 1-based line numbers where it appears) }. Do NOT output `id` or `bookmarkable`. List each distinct token ONCE with all its line numbers; do not duplicate.",
];

export function codeChunkDirectives(request: AgentAnalyzeRequest): string[] {
  if (request.outlineOnly) {
    return [
      "OUTLINE MODE: set lineExplanations to an empty array []. Do NOT explain individual lines.",
      "Produce title, summary (2-3 sentences), language, concepts, and tokens (no lineExplanations). Each concept conceptId must be UNIQUE.",
      "concepts: extract ALL key concepts a beginner might not know that actually appear in this code — language syntax/operator patterns, built-in types & generics, async (Promise/async-await), array/object methods, APIs/DOM, library & runtime concepts, etc. Be comprehensive and don't under-produce (scale the count to the code size), but skip trivial or duplicate ones — each concept should be worth a beginner actually learning. Do NOT add general concepts unrelated to this code.",
      ...TOKEN_EXTRACT,
    ];
  }
  if (request.lineRange) {
    const { start, end } = request.lineRange;
    const known = (request.knownConcepts ?? [])
      .map((c) => `${c.conceptId} (${c.title})`)
      .join(", ");
    return [
      `LINE-RANGE MODE: the code below is a SNIPPET — it is lines ${start} to ${end} (inclusive, 1-based) of a larger file. Explain EVERY meaningful CODE line in this snippet. Do NOT return an empty array — this snippet has code to explain.`,
      `Number each lineExplanation with its ABSOLUTE line number in the larger file: this snippet's FIRST line is line ${start}, so count up from ${start}.`,
      "Skip comment-only lines and blank lines — do NOT create a lineExplanation for them. Only explain lines that contain actual code.",
      ...EXPLANATION_FORMAT,
      'Set concepts to [] and tokens to [] and leave title and summary as empty strings "" — they are produced in a separate pass.',
      known
        ? `lineExplanations.conceptIds must reference ONLY these existing concept ids: ${known}. Do NOT invent new concept ids.`
        : "lineExplanations.conceptIds may be an empty array.",
    ];
  }
  return [
    "lineExplanations.conceptIds must reference concepts[].conceptId.",
    "concepts: extract ALL key concepts a beginner might not know that actually appear in this code — language syntax/operator patterns, built-in types & generics, async (Promise/async-await), array/object methods, APIs/DOM, library & runtime concepts, etc. Be comprehensive and don't under-produce (scale the count to the code size), but skip trivial or duplicate ones — each concept should be worth a beginner actually learning. Do NOT add general concepts unrelated to this code. Each conceptId UNIQUE.",
    "Give one lineExplanations entry for EVERY meaningful CODE line — but SKIP comment-only lines and blank lines (do NOT create entries for them). The top-level summary is 2-3 sentences.",
    ...EXPLANATION_FORMAT,
    ...TOKEN_EXTRACT,
  ];
}
