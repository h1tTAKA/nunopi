// 글(IT 용어) 분석 모드 — 프로바이더(claude/codex/openai)는 실행 방식만 다르고
// 프롬프트와 출력 정규화는 동일하므로 여기서 공용화한다. 각 프로바이더는
// request.mode === "text"일 때 buildTextPrompt로 프롬프트를 만들고 normalizeTextOutput으로
// 결과를 정규화한다.
import type { AgentAnalyzeRequest, AgentAnalyzeResponse, AgentUsage } from "./schema";
import type { AgentProviderKind } from "./types";
import type { ItConcept, ItTerm, TranslateWarning } from "@/lib/translator/types";

const JSON_CODE_BLOCK_PATTERN = /```json\s*([\s\S]*?)```/i;

// IT 용어 글을 초보자용으로 분석하라는 프롬프트(JSON only).
const TEXT_HEADER = [
  "You are Nunopi's IT-term explainer for absolute beginners.",
  "The input is a piece of IT-related prose (e.g. an X/Twitter post, a tech article).",
  "It is NOT source code. Do not treat it as code.",
  "Explain it in Korean so that even a beginner with no IT background understands.",
  "Return JSON only.",
  "",
  "Tone (IMPORTANT):",
  "- Write ALL Korean text in plain declarative style ending in '~다' (평서체).",
  "- Do NOT use polite/honorific or childish endings like '~에요', '~예요', '~해요', '~요'.",
  "- Match the dry, neutral tone of code analysis. Be easy and friendly but never use honorifics.",
];

function textTail(request: AgentAnalyzeRequest): string[] {
  return [
    "",
    `Locale: ${request.locale}`,
    `User intent: ${request.userIntent ?? "Explain the IT terms in this text for a beginner in Korean."}`,
    "",
    "Text to analyze:",
    '"""',
    request.code,
    '"""',
  ];
}

export function buildTextPrompt(request: AgentAnalyzeRequest): string {
  // 1차 outline — 용어/개념 "골격"만(설명 없이) 빠르게. 청크 스트리밍의 첫 단계.
  if (request.textStage === "outline") {
    return [
      ...TEXT_HEADER,
      "",
      "OUTLINE STAGE: list the IT terms and related concepts, but DO NOT write explanations yet.",
      "Output JSON shape:",
      "{",
      '  "title": "string (글 핵심 주제 짧은 한국어 명사구, 문장/마침표 금지, 6~24자)",',
      '  "summary": "string (글 전체를 초보자도 이해할 쉬운 한국어 평서체 3-5문장 요약)",',
      '  "terms": [ { "id": "string unique", "term": "글에 실제 등장한 IT 용어 그대로", "reading": "string optional 약어풀이/원어", "explanation": "", "conceptIds": "string[] 관련 concepts[].conceptId", "bookmarkable": true } ],',
      '  "concepts": [ { "conceptId": "string unique", "title": "관련 개념 이름(한국어 가능)", "explanation": "" } ],',
      '  "warnings": []',
      "}",
      "",
      "Rules:",
      "- explanation은 모두 빈 문자열 \"\"로 둔다(다음 단계에서 채움).",
      "- Extract ONLY IT/tech terms that actually appear. Skip trivial/duplicate.",
      "- 용어 설명에 또 필요한 배경 개념을 concepts에 넣고 term.conceptIds로 연결.",
      "- term.id, concept.conceptId는 전체에서 UNIQUE.",
      ...textTail(request),
    ].join("\n");
  }

  // 2차 terms — 주어진 용어들의 explanation만 채운다.
  if (request.textStage === "terms") {
    const list = (request.targetTerms ?? [])
      .map((t) => `  - id=${t.id} term=${JSON.stringify(t.term)}${t.reading ? ` reading=${JSON.stringify(t.reading)}` : ""}`)
      .join("\n");
    return [
      ...TEXT_HEADER,
      "",
      "TERMS STAGE: for EACH given term, write its explanation based on the text.",
      "Each explanation: 1-2 short sentences, beginner-friendly, plain '~다' tone. No padding.",
      "Output JSON shape:",
      "{",
      '  "terms": [ { "id": "주어진 id 그대로", "term": "주어진 term 그대로", "reading": "주어진 reading 그대로(있으면)", "explanation": "이 용어 설명 1-2문장", "conceptIds": "주어진 conceptIds 그대로", "bookmarkable": true } ],',
      '  "concepts": [], "warnings": []',
      "}",
      "Return ONLY these terms (same id/term), with explanation filled. Do not add new terms or concepts.",
      "",
      "Terms to explain:",
      list || "  (none)",
      ...textTail(request),
    ].join("\n");
  }

  // 3차 concepts — 주어진 개념들의 explanation만 채운다.
  if (request.textStage === "concepts") {
    const list = (request.targetConcepts ?? [])
      .map((c) => `  - conceptId=${c.conceptId} title=${JSON.stringify(c.title)}`)
      .join("\n");
    return [
      ...TEXT_HEADER,
      "",
      "CONCEPTS STAGE: for EACH given concept, write its explanation (background idea behind the terms), based on the text context.",
      "Each explanation: 1-2 short sentences, beginner-friendly, plain '~다' tone.",
      "Output JSON shape:",
      "{",
      '  "terms": [], "concepts": [ { "conceptId": "주어진 conceptId 그대로", "title": "주어진 title 그대로", "explanation": "이 개념 설명 1-2문장" } ], "warnings": []',
      "}",
      "Return ONLY these concepts (same conceptId/title), with explanation filled. Do not add new ones.",
      "",
      "Concepts to explain:",
      list || "  (none)",
      ...textTail(request),
    ].join("\n");
  }

  // 기본(단일 호출) — 작은 글/폴백. 전체를 한 번에.
  return [
    ...TEXT_HEADER,
    "",
    "Be concise (this also keeps responses fast):",
    "- Each term explanation: 1-2 short sentences with the essence (use a quick analogy only if it helps).",
    "- summary: 3-5 sentences max.",
    "- Each concept explanation: 1-2 short sentences.",
    "- Cover the IT terms that actually appear; skip trivial/duplicate ones. Do not pad.",
    "",
    "Output JSON shape:",
    "{",
    '  "title": "string (이 글의 핵심 주제를 압축한 짧은 한국어 명사구 제목. 문장/마침표 금지, 6~24자, 구체적으로. 예: \\"AMM·슬리피지 입문\\")",',
    '  "summary": "string (글 전체를 IT를 모르는 초보자도 이해할 만큼 쉬운 한국어 평서체로 3-5문장 요약)",',
    '  "terms": [',
    "    {",
    '      "id": "string (unique, referenced by other terms.conceptIds via concepts)",',
    '      "term": "string (글에 실제로 등장한 IT 용어 그대로, 예: AMM, LP, 슬리피지, 오라클)",',
    '      "reading": "string (optional, 약어 풀이나 원어. 예: \\"AMM = Automated Market Maker\\")",',
    '      "explanation": "string (그 용어가 무슨 뜻인지 초보자 눈높이로 쉽게, 한국어 평서체로 1-2문장)",',
    '      "conceptIds": "string[] (이 용어 설명을 이해하려면 더 알아야 하는 concepts[].conceptId들)",',
    '      "bookmarkable": true',
    "    }",
    "  ],",
    '  "concepts": [',
    "    {",
    '      "conceptId": "string (unique)",',
    '      "title": "string (관련 개념 이름, 한국어 가능)",',
    '      "explanation": "string (그 개념을 초보자 눈높이로 쉽게, 한국어 평서체로 1-2문장)"',
    "    }",
    "  ],",
    '  "warnings": [{ "code": "PARTIAL_PARSE | UNKNOWN_LANGUAGE | PARSE_FAILED | TOO_LONG", "message": "string" }]',
    "}",
    "",
    "Rules:",
    "- Extract ONLY IT/tech-related terms from the text. Ignore ordinary words.",
    "- For a term whose explanation itself uses another term a beginner likely doesn't know, add that to concepts and link it via the term's conceptIds.",
    "- Every term.id and every concept.conceptId must be UNIQUE across the whole response.",
    "- All explanations in beginner-friendly Korean, plain declarative '~다' tone, concise (1-2 sentences).",
    "- Only include a PARTIAL_PARSE warning if the input was actually truncated; otherwise return an empty warnings array.",
    ...textTail(request),
  ].join("\n");
}

// 프로바이더 출력(rawText)을 글 모드 AgentAnalyzeResponse로 정규화한다.
export function normalizeTextOutput(
  rawText: string,
  providerId: AgentProviderKind,
  request: AgentAnalyzeRequest,
  usage?: AgentUsage,
): AgentAnalyzeResponse {
  const parsed = parseTextPayload(rawText);

  if (!parsed) {
    return textModeResponse(
      providerId,
      "AI가 돌려준 응답을 글 분석 형식으로 해석하지 못했다. 다시 시도해 보라.",
      [
        {
          code: "PARSE_FAILED",
          message: "Text-mode output could not be normalized into the expected JSON schema.",
        },
      ],
      usage,
      rawText,
    );
  }

  const terms = dedupeById(
    (Array.isArray(parsed.terms) ? parsed.terms : []).filter(isItTerm),
  ).map((t) => ({
    // IT 용어는 전부 북마크 가능(모델 재량 무시). conceptIds 누락 시 빈 배열.
    ...t,
    conceptIds: t.conceptIds ?? [],
    bookmarkable: true,
  }));
  const itConcepts = dedupeByConceptId(
    (Array.isArray(parsed.concepts) ? parsed.concepts : []).filter(isItConcept),
  );

  return {
    providerId,
    mode: "text",
    language: "text",
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : undefined,
    summary: parsed.summary ?? "요약을 생성하지 못했다.",
    lineExplanations: [],
    tokens: [],
    concepts: [],
    terms,
    itConcepts,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(isWarning) : [],
    usage,
    rawText,
    createdAt: new Date().toISOString(),
  };
}

// 글 모드 실패/안내용 응답(파싱 실패, 런타임 미탐지, 에러 등).
export function textModeResponse(
  providerId: AgentProviderKind,
  summary: string,
  warnings: TranslateWarning[],
  usage?: AgentUsage,
  rawText?: string,
): AgentAnalyzeResponse {
  return {
    providerId,
    mode: "text",
    language: "text",
    summary,
    lineExplanations: [],
    tokens: [],
    concepts: [],
    terms: [],
    itConcepts: [],
    warnings,
    usage,
    rawText,
    createdAt: new Date().toISOString(),
  };
}

interface TextNormalizedPayload {
  summary?: string;
  title?: string;
  terms?: unknown[];
  concepts?: unknown[];
  warnings?: TranslateWarning[];
}

function parseTextPayload(rawText: string): TextNormalizedPayload | null {
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate);
    if (!isTextNormalizedPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractJsonCandidate(rawText: string): string | null {
  const blockMatch = rawText.match(JSON_CODE_BLOCK_PATTERN);
  if (blockMatch?.[1]) return blockMatch[1].trim();
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  return null;
}

function isTextNormalizedPayload(value: unknown): value is TextNormalizedPayload {
  if (!isRecord(value)) return false;
  if (value.summary !== undefined && typeof value.summary !== "string") return false;
  // terms/concepts는 배열 여부만 느슨히 검사하고, 요소 검증은 filter로 처리한다
  // (한 항목이 어긋나도 요약·나머지 항목을 잃지 않게).
  if (value.terms !== undefined && !Array.isArray(value.terms)) return false;
  if (value.concepts !== undefined && !Array.isArray(value.concepts)) return false;
  // warnings도 배열 여부만 느슨히 검사하고, 요소 검증은 normalize의 filter로 처리한다
  // (형식 안 맞는 warning 하나로 요약·용어를 통째로 잃지 않게).
  if (value.warnings !== undefined && !Array.isArray(value.warnings)) return false;
  return true;
}

function isItTerm(value: unknown): value is ItTerm {
  if (!isRecord(value)) return false;
  // id/term/explanation만 필수. conceptIds/bookmarkable은 normalize에서 기본값/강제하므로
  // 누락돼도 드랍하지 않는다(있으면 타입만 확인).
  return (
    typeof value.id === "string" &&
    typeof value.term === "string" &&
    typeof value.explanation === "string" &&
    (value.reading === undefined || typeof value.reading === "string") &&
    (value.conceptIds === undefined ||
      (Array.isArray(value.conceptIds) && value.conceptIds.every((id) => typeof id === "string")))
  );
}

function isItConcept(value: unknown): value is ItConcept {
  if (!isRecord(value)) return false;
  return (
    typeof value.conceptId === "string" &&
    typeof value.title === "string" &&
    typeof value.explanation === "string"
  );
}

function dedupeById(terms: ItTerm[]): ItTerm[] {
  const seen = new Set<string>();
  return terms.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

function dedupeByConceptId(concepts: ItConcept[]): ItConcept[] {
  const seen = new Set<string>();
  return concepts.filter((c) =>
    seen.has(c.conceptId) ? false : (seen.add(c.conceptId), true),
  );
}


function isWarning(value: unknown): value is TranslateWarning {
  if (!isRecord(value)) return false;
  return isWarningCode(value.code) && typeof value.message === "string";
}

function isWarningCode(value: unknown): value is TranslateWarning["code"] {
  return (
    value === "TOO_LONG" ||
    value === "PARSE_FAILED" ||
    value === "PARTIAL_PARSE" ||
    value === "UNKNOWN_LANGUAGE"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
