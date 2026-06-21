// 병렬 청크(2단계) 코드 분석용 프롬프트 지시문. claude/codex/openai 코드 모드
// buildPrompt가 공유한다. request 플래그에 따라 "줄설명 지시" 부분만 교체한다.
// - outlineOnly: 1차. 개념/요약/제목만, 줄설명 비움.
// - lineRange: 2차. 그 범위 줄설명만, 개념은 비우고 1차 개념 id만 참조.
// - 둘 다 아니면: 기존 전체 분석.
import type { AgentAnalyzeRequest } from "./schema";

export function codeChunkDirectives(request: AgentAnalyzeRequest): string[] {
  if (request.outlineOnly) {
    return [
      "OUTLINE MODE: set lineExplanations to an empty array []. Do NOT explain individual lines.",
      "Produce ONLY title, summary (2-3 sentences), language, and concepts. Each concept conceptId must be UNIQUE.",
      "concepts: extract ALL key concepts a beginner might not know that actually appear in this code — language syntax/operator patterns, built-in types & generics, async (Promise/async-await), array/object methods, APIs/DOM, library & runtime concepts, etc. Be comprehensive and don't under-produce (scale the count to the code size), but skip trivial or duplicate ones — each concept should be worth a beginner actually learning. Do NOT add general concepts unrelated to this code.",
    ];
  }
  if (request.lineRange) {
    const { start, end } = request.lineRange;
    const known = (request.knownConcepts ?? [])
      .map((c) => `${c.conceptId} (${c.title})`)
      .join(", ");
    return [
      `LINE-RANGE MODE: the full code is provided for context, but produce lineExplanations ONLY for lines ${start} to ${end} (inclusive, 1-based). Give one entry for EVERY meaningful CODE line in that range using its real absolute line number. Each explanation is ONE short sentence.`,
      "Skip comment-only lines and blank lines — do NOT create a lineExplanation for them. Only explain lines that contain actual code.",
      'Set concepts to [] and leave title and summary as empty strings "" — they are produced in a separate pass.',
      known
        ? `lineExplanations.conceptIds must reference ONLY these existing concept ids: ${known}. Do NOT invent new concept ids.`
        : "lineExplanations.conceptIds may be an empty array.",
    ];
  }
  return [
    "lineExplanations.conceptIds must reference concepts[].conceptId.",
    "concepts: extract ALL key concepts a beginner might not know that actually appear in this code — language syntax/operator patterns, built-in types & generics, async (Promise/async-await), array/object methods, APIs/DOM, library & runtime concepts, etc. Be comprehensive and don't under-produce (scale the count to the code size), but skip trivial or duplicate ones — each concept should be worth a beginner actually learning. Do NOT add general concepts unrelated to this code. Each conceptId UNIQUE.",
    "Give one lineExplanations entry for EVERY meaningful CODE line — but SKIP comment-only lines and blank lines (do NOT create entries for them). Each line explanation is ONE short sentence; summary is 2-3 sentences. Do not pad.",
  ];
}
