export type SupportedLanguage =
  | "react"
  | "typescript"
  | "javascript"
  | "css"
  | "tailwindcss"
  | "unknown";

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
