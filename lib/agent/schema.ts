import type {
  CodeToken,
  ConceptOccurrence,
  SupportedLanguage,
  TranslateResponse,
  TranslateWarning,
} from "@/lib/translator/types";
import type { AgentProviderKind } from "./types";

export interface ProviderSettings {
  "openai-compatible"?: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };
}

export interface AgentAnalyzeRequest {
  code: string;
  locale: "ko";
  providerId: AgentProviderKind;
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
  language: string;
  summary: string;
  lineExplanations: AgentLineExplanation[];
  tokens: CodeToken[];
  concepts: ConceptOccurrence[];
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
