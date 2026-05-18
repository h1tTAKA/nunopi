import type {
  AgentAnalyzeRequest,
  AgentAnalyzeResponse,
  AgentProvider,
  AgentProviderKind,
} from "@/lib/agent";
import { detectLanguage, type DetectLanguageResult } from "./detectLanguage";
import type { TranslateRequest, TranslateResponse } from "./types";

export interface AnalyzeCodeParams {
  request: TranslateRequest;
  providerId: AgentProviderKind;
  registry: TranslatorProviderRegistry;
  userIntent?: string;
}

export interface TranslatorProviderRegistry {
  getProvider(id: AgentProviderKind): AgentProvider | undefined;
  getFallbackProvider?(): AgentProvider | undefined;
}

export interface OrchestratorResult {
  response: TranslateResponse;
  agentResponse?: AgentAnalyzeResponse;
  detectedLanguage: DetectLanguageResult;
  usedProviderId: AgentProviderKind;
  fallbackUsed: boolean;
}

export async function analyzeCode(
  params: AnalyzeCodeParams,
): Promise<OrchestratorResult> {
  const detectedLanguage = detectLanguage(params.request.code);
  const provider = resolveProvider(params.registry, params.providerId);
  const agentRequest = buildAgentAnalyzeRequest(params, detectedLanguage);
  const agentResponse = await provider.analyze(agentRequest);

  return {
    response: buildPendingTranslateResponse(params.request, agentResponse, detectedLanguage),
    agentResponse,
    detectedLanguage,
    usedProviderId: provider.metadata.id,
    fallbackUsed: false,
  };
}

function resolveProvider(
  registry: TranslatorProviderRegistry,
  providerId: AgentProviderKind,
): AgentProvider {
  const provider = registry.getProvider(providerId);

  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  return provider;
}

function buildAgentAnalyzeRequest(
  params: AnalyzeCodeParams,
  detectedLanguage: DetectLanguageResult,
): AgentAnalyzeRequest {
  return {
    code: params.request.code,
    locale: params.request.locale,
    providerId: params.providerId,
    detectedLanguage: detectedLanguage.primary,
    userIntent: params.userIntent,
    options: {
      maxLines: params.request.options?.maxLines,
      includeTokens: true,
      includeConcepts: true,
      includeRawOutput: false,
    },
  };
}

function buildPendingTranslateResponse(
  request: TranslateRequest,
  agentResponse: AgentAnalyzeResponse,
  detectedLanguage: DetectLanguageResult,
): TranslateResponse {
  return {
    language: agentResponse.language,
    secondaryLanguages: detectedLanguage.secondary,
    totalLines: countTotalLines(request.code),
    matchedLines: 0,
    partialLines: 0,
    unmatchedLines: 0,
    skippedLines: 0,
    lineResults: [],
    tokens: agentResponse.tokens,
    concepts: agentResponse.concepts,
    warnings: agentResponse.warnings,
    createdAt: agentResponse.createdAt,
  };
}

function countTotalLines(code: string): number {
  return code.split(/\r?\n/).length;
}
