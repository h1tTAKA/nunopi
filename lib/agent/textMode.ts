// 글(IT 용어) 분석 모드 — 프로바이더(claude/codex/openai)는 실행 방식만 다르고
// 프롬프트와 출력 정규화는 동일하므로 여기서 공용화한다. 각 프로바이더는
// request.mode === "text"일 때 buildTextPrompt로 프롬프트를 만들고 normalizeTextOutput으로
// 결과를 정규화한다.
import type { AgentAnalyzeRequest, AgentAnalyzeResponse, AgentUsage } from "./schema";
import type { AgentProviderKind } from "./types";
import type { ItConcept, ItTerm, TranslateWarning } from "@/lib/translator/types";

const JSON_CODE_BLOCK_PATTERN = /```json\s*([\s\S]*?)```/i;

// IT 용어 글을 초보자용으로 분석하라는 프롬프트(JSON only).
export function buildTextPrompt(request: AgentAnalyzeRequest): string {
  return [
    "You are Nunopi's IT-term explainer for absolute beginners.",
    "The input is a piece of IT-related prose (e.g. an X/Twitter post, a tech article).",
    "It is NOT source code. Do not treat it as code.",
    "Explain it in Korean so that even a child with no IT background understands.",
    "Return JSON only.",
    "",
    "Output JSON shape:",
    "{",
    '  "summary": "string (글 전체를 IT를 모르는 초등학생도 이해할 만큼 아주 쉬운 한국어로 요약. 비유를 적극 사용)",',
    '  "terms": [',
    "    {",
    '      "id": "string (unique, referenced by other terms.conceptIds via concepts)",',
    '      "term": "string (글에 실제로 등장한 IT 용어 그대로, 예: AMM, LP, 슬리피지, 오라클)",',
    '      "reading": "string (optional, 약어 풀이나 원어. 예: \\"AMM = Automated Market Maker\\")",',
    '      "explanation": "string (그 용어가 무슨 뜻인지 초등학생 눈높이로, 비유를 들어 쉽게 한국어로 설명)",',
    '      "conceptIds": "string[] (이 용어 설명을 이해하려면 더 알아야 하는 concepts[].conceptId들)",',
    '      "bookmarkable": true',
    "    }",
    "  ],",
    '  "concepts": [',
    "    {",
    '      "conceptId": "string (unique)",',
    '      "title": "string (관련 개념 이름, 한국어 가능)",',
    '      "explanation": "string (그 개념을 초등학생 눈높이로 쉽게 한국어로 설명)"',
    "    }",
    "  ],",
    '  "warnings": [{ "code": "PARTIAL_PARSE | UNKNOWN_LANGUAGE | PARSE_FAILED | TOO_LONG", "message": "string" }]',
    "}",
    "",
    "Rules:",
    "- Extract ONLY IT/tech-related terms from the text. Ignore ordinary words.",
    "- For a term whose explanation itself uses another term a beginner likely doesn't know, add that to concepts and link it via the term's conceptIds.",
    "- Every term.id and every concept.conceptId must be UNIQUE across the whole response.",
    "- All explanations in beginner-friendly Korean. Prefer analogies.",
    "- Only include a PARTIAL_PARSE warning if the input was actually truncated; otherwise return an empty warnings array.",
    "",
    `Locale: ${request.locale}`,
    `User intent: ${request.userIntent ?? "Explain the IT terms in this text for a beginner in Korean."}`,
    "",
    "Text to analyze:",
    '"""',
    request.code,
    '"""',
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
  );
  const itConcepts = dedupeByConceptId(
    (Array.isArray(parsed.concepts) ? parsed.concepts : []).filter(isItConcept),
  );

  return {
    providerId,
    mode: "text",
    language: "text",
    summary: parsed.summary ?? "요약을 생성하지 못했다.",
    lineExplanations: [],
    tokens: [],
    concepts: [],
    terms,
    itConcepts,
    warnings: parsed.warnings ?? [],
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
  if (value.warnings !== undefined && !isWarningList(value.warnings)) return false;
  return true;
}

function isItTerm(value: unknown): value is ItTerm {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.term === "string" &&
    typeof value.explanation === "string" &&
    (value.reading === undefined || typeof value.reading === "string") &&
    Array.isArray(value.conceptIds) &&
    value.conceptIds.every((id) => typeof id === "string") &&
    typeof value.bookmarkable === "boolean"
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

function isWarningList(value: unknown): value is TranslateWarning[] {
  return Array.isArray(value) && value.every(isWarning);
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
