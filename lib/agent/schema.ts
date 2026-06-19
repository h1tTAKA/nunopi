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

// 분석 모드 — "code"(기본, 코드 분석) | "text"(IT 용어 글 분석).
export type AnalyzeMode = "code" | "text";

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
  tokenIds: string[];
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
