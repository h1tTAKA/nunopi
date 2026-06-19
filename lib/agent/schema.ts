import type {
  CodeToken,
  ConceptOccurrence,
  ItConcept,
  ItTerm,
  SupportedLanguage,
  TranslateResponse,
  TranslateWarning,
} from "@/lib/translator/types";
import type { AgentProviderKind } from "./types";

// 분석 모드 — "code"(기본, 코드 분석) | "text"(IT 용어 글 분석)
// | "explain-token"(토큰 1개 on-demand 설명) | "explain-concept"(개념 1개 on-demand 설명).
export type AnalyzeMode = "code" | "text" | "explain-token" | "explain-concept";

export interface ProviderSettings {
  "openai-compatible"?: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };
  "claude-agent"?: {
    cliPath?: string;
  };
  "codex-agent"?: {
    cliPath?: string;
  };
}

export interface AgentAnalyzeRequest {
  code: string; // 분석 입력 — code 모드는 소스코드, text 모드는 붙여넣은 글.
  locale: "ko";
  providerId: AgentProviderKind;
  mode?: AnalyzeMode; // 기본 "code".
  targetToken?: string; // mode "explain-token"일 때 설명할 토큰 텍스트.
  targetConcept?: string; // mode "explain-concept"일 때 설명할 개념 제목.
  detectedLanguage?: SupportedLanguage;
  userIntent?: string;
  options?: AgentAnalyzeOptions;
  providerSettings?: ProviderSettings;
}

export interface AgentAnalyzeOptions {
  maxLines?: number;
  includeTokens?: boolean;
  includeConcepts?: boolean;
  includeRawOutput?: boolean;
  timeoutMs?: number;
}

export interface AgentAnalyzeResponse {
  providerId: AgentProviderKind;
  mode?: AnalyzeMode; // 기본 "code". "text"면 terms/itConcepts를 사용.
  language: string;
  summary: string;
  // 코드 모드 필드 (text 모드에선 빈 배열).
  lineExplanations: AgentLineExplanation[];
  tokens: CodeToken[];
  concepts: ConceptOccurrence[];
  // 글(text) 모드 필드.
  terms?: ItTerm[]; // IT 용어 사전
  itConcepts?: ItConcept[]; // 관련 개념
  warnings: TranslateWarning[];
  rawText?: string;
  usage?: AgentUsage;
  createdAt: string;
}

export interface AgentLineExplanation {
  line: number;
  code: string;
  explanation: string;
  tokens?: string[]; // 그 줄의 의미 토큰 텍스트(lazy 사전: 칩으로 표시, 클릭 시 on-demand 설명).
  tokenIds?: string[]; // 레거시(사전 id 참조) — 하위호환용.
  conceptIds: string[];
  confidence?: number;
}

export interface AgentUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

export interface AgentToTranslateMapping {
  source: AgentAnalyzeResponse;
  response: TranslateResponse;
}
