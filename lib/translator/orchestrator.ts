import type {
  AgentAnalyzeRequest,
  AgentAnalyzeResponse,
  AgentProvider,
  AgentProviderKind,
} from "@/lib/agent";
import { detectLanguage, type DetectLanguageResult } from "./detectLanguage";
import type {
  ExplanationBlock,
  ExplanationSegment,
  LineResult,
  SupportedLanguage,
  TranslateRequest,
  TranslateResponse,
  TranslateWarning,
} from "./types";

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
  const resolved = await resolveAgentResponse(params, detectedLanguage);
  const response = buildTranslateResponse(
    params.request,
    resolved.agentResponse,
    detectedLanguage,
    resolved.warnings,
  );

  return {
    response,
    agentResponse: resolved.agentResponse,
    detectedLanguage,
    usedProviderId: resolved.usedProviderId,
    fallbackUsed: resolved.fallbackUsed,
  };
}

interface ResolvedAgentResponse {
  agentResponse: AgentAnalyzeResponse;
  usedProviderId: AgentProviderKind;
  fallbackUsed: boolean;
  warnings: TranslateWarning[];
}

async function resolveAgentResponse(
  params: AnalyzeCodeParams,
  detectedLanguage: DetectLanguageResult,
): Promise<ResolvedAgentResponse> {
  const primaryProvider = params.registry.getProvider(params.providerId);

  if (primaryProvider) {
    try {
      const primaryResponse = await primaryProvider.analyze(
        buildAgentAnalyzeRequest(params, detectedLanguage, primaryProvider.metadata.id),
      );

      return {
        agentResponse: primaryResponse,
        usedProviderId: primaryProvider.metadata.id,
        fallbackUsed: false,
        warnings: [],
      };
    } catch (error) {
      const fallbackProvider = findFallbackProvider(params.registry, primaryProvider.metadata.id);

      if (fallbackProvider) {
        const fallbackResponse = await fallbackProvider.analyze(
          buildAgentAnalyzeRequest(params, detectedLanguage, fallbackProvider.metadata.id),
        );

        return {
          agentResponse: fallbackResponse,
          usedProviderId: fallbackProvider.metadata.id,
          fallbackUsed: true,
          warnings: [buildPartialWarning(`Primary provider failed: ${formatErrorMessage(error)}`)],
        };
      }

      return {
        agentResponse: buildFailureAgentResponse(params, detectedLanguage, [
          buildParseFailedWarning(`Provider failed: ${formatErrorMessage(error)}`),
        ]),
        usedProviderId: params.providerId,
        fallbackUsed: false,
        warnings: [],
      };
    }
  }

  const fallbackProvider = findFallbackProvider(params.registry, params.providerId);

  if (fallbackProvider) {
    const fallbackResponse = await fallbackProvider.analyze(
      buildAgentAnalyzeRequest(params, detectedLanguage, fallbackProvider.metadata.id),
    );

    return {
      agentResponse: fallbackResponse,
      usedProviderId: fallbackProvider.metadata.id,
      fallbackUsed: true,
      warnings: [
        buildPartialWarning(`Requested provider not found: ${params.providerId}. Fallback provider was used.`),
      ],
    };
  }

  return {
    agentResponse: buildFailureAgentResponse(params, detectedLanguage, [
      buildParseFailedWarning(`Provider not found: ${params.providerId}`),
    ]),
    usedProviderId: params.providerId,
    fallbackUsed: false,
    warnings: [],
  };
}

function findFallbackProvider(
  registry: TranslatorProviderRegistry,
  excludedProviderId: AgentProviderKind,
): AgentProvider | undefined {
  const fallbackProvider = registry.getFallbackProvider?.();

  if (!fallbackProvider || fallbackProvider.metadata.id === excludedProviderId) {
    return undefined;
  }

  return fallbackProvider;
}

function buildAgentAnalyzeRequest(
  params: AnalyzeCodeParams,
  detectedLanguage: DetectLanguageResult,
  providerId: AgentProviderKind,
): AgentAnalyzeRequest {
  return {
    code: params.request.code,
    locale: params.request.locale,
    providerId,
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

function buildTranslateResponse(
  request: TranslateRequest,
  agentResponse: AgentAnalyzeResponse,
  detectedLanguage: DetectLanguageResult,
  extraWarnings: TranslateWarning[],
): TranslateResponse {
  const lineResults = mapLineResults(request.code, agentResponse);
  const warnings = [
    ...agentResponse.warnings,
    ...extraWarnings,
    ...buildDetectedLanguageWarnings(detectedLanguage),
  ];

  return {
    language: normalizeResponseLanguage(agentResponse.language, detectedLanguage.primary),
    secondaryLanguages: detectedLanguage.secondary,
    totalLines: lineResults.length,
    matchedLines: countLineResults(lineResults, "matched"),
    partialLines: countLineResults(lineResults, "partial"),
    unmatchedLines: countLineResults(lineResults, "unmatched"),
    skippedLines: countLineResults(lineResults, "skipped"),
    lineResults,
    tokens: agentResponse.tokens,
    concepts: agentResponse.concepts,
    warnings,
    createdAt: agentResponse.createdAt,
  };
}

function normalizeResponseLanguage(
  value: string,
  fallback: SupportedLanguage,
): SupportedLanguage {
  if (isSupportedLanguage(value)) {
    return value;
  }

  if (fallback !== "unknown") {
    return fallback;
  }

  return "unknown";
}

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (
    value === "react" ||
    value === "typescript" ||
    value === "javascript" ||
    value === "css" ||
    value === "tailwindcss" ||
    value === "unknown"
  );
}

function mapLineResults(code: string, agentResponse: AgentAnalyzeResponse): LineResult[] {
  const sourceLines = code.split(/\r?\n/);
  const explanationMap = new Map(
    agentResponse.lineExplanations.map((lineExplanation) => [lineExplanation.line, lineExplanation]),
  );

  return sourceLines.map((sourceLine, index) => {
    const lineNumber = index + 1;
    const lineExplanation = explanationMap.get(lineNumber);

    if (!sourceLine.trim()) {
      return {
        line: lineNumber,
        code: sourceLine,
        status: "skipped",
        patternIds: [],
        explanations: [],
      };
    }

    if (!lineExplanation) {
      return {
        line: lineNumber,
        code: sourceLine,
        status: "unmatched",
        patternIds: [],
        explanations: [],
      };
    }

    const explanations = buildExplanationBlocks(lineExplanation);
    const hasPartialSignal = lineExplanation.confidence !== undefined && lineExplanation.confidence < 0.75;

    return {
      line: lineNumber,
      code: sourceLine,
      status: hasPartialSignal ? "partial" : "matched",
      patternIds: [...lineExplanation.tokenIds, ...lineExplanation.conceptIds],
      explanations,
    };
  });
}

function buildExplanationBlocks(
  lineExplanation: AgentAnalyzeResponse["lineExplanations"][number],
): ExplanationBlock[] {
  const blocks: ExplanationBlock[] = [
    {
      id: `line-${lineExplanation.line}`,
      kind: "line",
      segments: [{ text: lineExplanation.explanation }],
    },
  ];

  if (lineExplanation.tokenIds.length > 0) {
    blocks.push({
      id: `tokens-${lineExplanation.line}`,
      kind: "token",
      segments: buildListSegments("관련 토큰: ", lineExplanation.tokenIds),
    });
  }

  if (lineExplanation.conceptIds.length > 0) {
    blocks.push({
      id: `concepts-${lineExplanation.line}`,
      kind: "concept",
      segments: buildListSegments("관련 개념: ", lineExplanation.conceptIds),
    });
  }

  return blocks;
}

function buildListSegments(prefix: string, values: string[]): ExplanationSegment[] {
  return [
    { text: prefix },
    ...values.flatMap((value, index) => {
      const segments: ExplanationSegment[] = [{ text: value, emphasis: "code" }];

      if (index < values.length - 1) {
        segments.push({ text: ", " });
      }

      return segments;
    }),
  ];
}

function countLineResults(
  lineResults: LineResult[],
  status: LineResult["status"],
): number {
  return lineResults.filter((lineResult) => lineResult.status === status).length;
}

function buildDetectedLanguageWarnings(
  detectedLanguage: DetectLanguageResult,
): TranslateWarning[] {
  if (detectedLanguage.primary !== "unknown") {
    return [];
  }

  return [buildUnknownLanguageWarning()];
}

function buildFailureAgentResponse(
  params: AnalyzeCodeParams,
  detectedLanguage: DetectLanguageResult,
  warnings: TranslateWarning[],
): AgentAnalyzeResponse {
  return {
    providerId: params.providerId,
    language: detectedLanguage.primary,
    summary: "Analysis failed before a provider response was produced.",
    lineExplanations: [],
    tokens: [],
    concepts: [],
    warnings,
    createdAt: new Date().toISOString(),
  };
}

function buildParseFailedWarning(message: string): TranslateWarning {
  return {
    code: "PARSE_FAILED",
    message,
  };
}

function buildPartialWarning(message: string): TranslateWarning {
  return {
    code: "PARTIAL_PARSE",
    message,
  };
}

function buildUnknownLanguageWarning(): TranslateWarning {
  return {
    code: "UNKNOWN_LANGUAGE",
    message: "The language detector could not determine a reliable primary language.",
  };
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown provider error";
}
