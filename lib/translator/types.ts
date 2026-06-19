export type SupportedLanguage =
  | "react"
  | "typescript"
  | "javascript"
  | "css"
  | "tailwindcss"
  | "unknown";

// 글(IT 용어) 분석 모드 — 코드의 CodeToken/ConceptOccurrence에 대응하는 산문용 타입.
// IT 용어 사전 한 항목.
export interface ItTerm {
  id: string;
  term: string; // 글에 등장한 IT 용어 그대로 (예: AMM, LP, 슬리피지)
  reading?: string; // 약어 풀이/원어 (예: "AMM = Automated Market Maker")
  explanation: string; // 초등학생도 이해할 쉬운 한국어 설명
  conceptIds: string[]; // 이 용어를 이해하는 데 더 필요한 관련 개념 id들
  bookmarkable: boolean;
}

// 관련 개념 한 항목 — 용어 설명에 또 필요한 상위/배경 개념.
export interface ItConcept {
  conceptId: string;
  title: string;
  explanation: string; // 이 개념을 초등학생 눈높이로 설명
}

export interface TranslateRequest {
  code: string;
  locale: "ko";
  options?: TranslateOptions;
}

export interface TranslateOptions {
  saveHistory?: boolean;
  maxLines?: number;
  enableTailwindAnalysis?: boolean;
}

export interface TranslateResponse {
  language: SupportedLanguage;
  secondaryLanguages: SupportedLanguage[];
  totalLines: number;
  matchedLines: number;
  partialLines: number;
  unmatchedLines: number;
  skippedLines: number;
  lineResults: LineResult[];
  tokens: CodeToken[];
  concepts: ConceptOccurrence[];
  warnings: TranslateWarning[];
  createdAt: string;
}

export interface LineResult {
  line: number;
  code: string;
  status: "matched" | "partial" | "unmatched" | "skipped";
  patternIds: string[];
  explanations: ExplanationBlock[];
}

export interface ExplanationBlock {
  id: string;
  kind: "line" | "token" | "concept";
  segments: ExplanationSegment[];
}

export interface ExplanationSegment {
  text: string;
  conceptId?: string;
  emphasis?: "normal" | "code" | "strong";
}

export type TokenCategory =
  | "react_hook"
  | "state_variable"
  | "state_setter"
  | "prop"
  | "function"
  | "event_handler"
  | "jsx_element"
  | "operator"
  | "keyword"
  | "punctuation"
  | "api_call"
  | "dependency_array"
  | "initial_value"
  | "css_selector"
  | "css_property"
  | "css_value"
  | "tailwind_utility"
  | "tailwind_layout"
  | "tailwind_spacing"
  | "tailwind_color"
  | "tailwind_responsive"
  | "tailwind_state";

export interface CodeToken {
  id: string;
  token: string;
  category: TokenCategory;
  label: string;
  description: string;
  example?: string;
  lines: number[];
  conceptId?: string;
  bookmarkable: boolean;
}

export interface ConceptEntry {
  id: string;
  title: string;
  aliases: string[];
  short: string;
  long: string;
  beginnerExample?: string;
  codeMeaning?: string;
  related: string[];
  level: "beginner" | "intermediate";
  category: "javascript" | "react" | "css" | "tailwind" | "web" | "general";
}

export interface ConceptOccurrence {
  conceptId: string;
  title: string;
  lines: number[];
  count: number;
}

export interface TranslateWarning {
  code: "TOO_LONG" | "PARSE_FAILED" | "PARTIAL_PARSE" | "UNKNOWN_LANGUAGE";
  message: string;
}
