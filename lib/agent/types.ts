import type {
  CodeToken,
  ConceptOccurrence,
  SupportedLanguage,
  TranslateResponse,
  TranslateWarning,
} from "@/lib/translator/types";

export type AgentProviderKind =
  | "local-rules"
  | "claude-agent"
  | "codex-agent"
  | "openai-app-server"
  | "openai-api-key"
  | "hermes-local"
  | "openai-compatible"
  | "mock";

export type AgentExecutionLocation =
  | "browser"
  | "local-server"
  | "desktop"
  | "remote-api";

export type AgentDataHandling =
  | "local-only"
  | "user-configured-endpoint"
  | "remote-provider";

export interface AgentProviderCapability {
  streaming: boolean;
  cancellation: boolean;
  fileSystemAccess: boolean;
  shellAccess: boolean;
  requiresApiKey: boolean;
  requiresLocalProcess: boolean;
}

export interface AgentProviderMetadata {
  id: AgentProviderKind;
  label: string;
  description: string;
  executionLocation: AgentExecutionLocation;
  dataHandling: AgentDataHandling;
  capabilities: AgentProviderCapability;
}

export interface AgentProvider {
  metadata: AgentProviderMetadata;
  analyze(request: AgentAnalyzeRequest): Promise<AgentAnalyzeResponse>;
}

export interface AgentAnalyzeRequest {
  code: string;
  locale: "ko";
  providerId: AgentProviderKind;
  detectedLanguage?: SupportedLanguage;
  userIntent?: string;
  options?: AgentAnalyzeOptions;
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
  language: SupportedLanguage;
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
