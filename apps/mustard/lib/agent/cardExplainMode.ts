// 암기 카드 "디폴트(맥락 독립) 설명" 프롬프트.
// 북마크에 박힌 "이 분석에서의 설명"이 아니라, 그 용어 자체의 범용 정의/발음/원어 +
// (코드 토큰이면) 예문·용도를 마크다운으로 생성한다. 응용력 학습용.
// 출력은 엄격 JSON 아님 — 마크다운 텍스트(스트리밍 타이핑 + 자유 형식).
import type { AgentAnalyzeRequest } from "./schema";
import { outputLanguageDirective } from "./outputLanguage";

export function buildCardExplainPrompt(request: AgentAnalyzeRequest): string {
  const term = request.targetTerm ?? "";
  const kind = request.targetKind ?? "term";
  const isCode = kind === "token" || kind === "concept";

  const lines = [
    "You are Nunopi's flashcard explainer for beginners.",
    `Explain the term "${term}" in general — NOT tied to any specific analysis or file.`,
    "Give the reusable, context-free meaning so the learner recognizes it anywhere.",
    "Output MARKDOWN only (no JSON, no code fences around the whole thing). Keep it compact.",
    "",
    "Structure:",
    `- First line: **${term}** followed by IPA pronunciation in slashes if it is an English word/term, and the English original/spelled-out form in parentheses if it is an abbreviation.`,
    "- Then 2-3 sentences: the general definition a beginner can grasp.",
  ];
  if (isCode) {
    lines.push(
      "- Then a '### 예문' section with 1-2 short, generic code examples in a fenced code block (not from any specific file).",
      "- Then a '### 이럴 때 써요' section: when/where you typically see or use it, to build transfer/recognition.",
    );
  } else {
    lines.push(
      "- Then a '### 이럴 때 나와요' section: typical contexts where this term shows up, to build recognition.",
    );
  }
  lines.push(
    "",
    outputLanguageDirective(request.locale),
    `Locale: ${request.locale}`,
    "Be concise. No preamble like 'Sure' — start directly with the term line.",
  );
  return lines.join("\n");
}
