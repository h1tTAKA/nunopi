import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProvider } from "./types";
import type { TranslateWarning } from "@/lib/translator/types";

interface OpenAICompatibleConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
}

interface OpenAICompatibleMessage {
  role: "system" | "user";
  content: string;
}

interface OpenAICompatibleRequestBody {
  model: string;
  messages: OpenAICompatibleMessage[];
  temperature: number;
  response_format: {
    type: "json_object";
  };
}

interface OpenAICompatibleNormalizedPayload {
  summary?: string;
  language?: string;
  lineExplanations?: AgentAnalyzeResponse["lineExplanations"];
  warnings?: TranslateWarning[];
}

interface OpenAICompatibleChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export const openAICompatibleProvider: AgentProvider = {
  metadata: {
    id: "openai-compatible",
    label: "OpenAI-Compatible",
    description:
      "Provider scaffold for OpenAI-style local or remote LLM endpoints such as Ollama gateways, vLLM, LiteLLM, or Hermes servers.",
    executionLocation: "local-server",
    dataHandling: "user-configured-endpoint",
    capabilities: {
      streaming: false,
      cancellation: false,
      fileSystemAccess: false,
      shellAccess: false,
      requiresApiKey: false,
      requiresLocalProcess: false,
    },
  },
  async analyze(request: AgentAnalyzeRequest): Promise<AgentAnalyzeResponse> {
    const config = resolveOpenAICompatibleConfig(request);
    const requestBody = buildOpenAICompatibleRequestBody(request, config);
    const rawResponse = process.env.NUNOPI_OPENAI_COMPAT_MOCK_RESPONSE?.trim();

    if (!rawResponse) {
      return buildPendingOpenAICompatibleResponse(request, config, requestBody);
    }

    return normalizeOpenAICompatibleResponse(rawResponse, request, config, requestBody);
  },
};

function buildPendingOpenAICompatibleResponse(
  request: AgentAnalyzeRequest,
  config: OpenAICompatibleConfig,
  requestBody: OpenAICompatibleRequestBody,
): AgentAnalyzeResponse {
  return {
    providerId: "openai-compatible",
    language: request.detectedLanguage ?? "unknown",
    summary:
      `OpenAI-compatible request contract is prepared for ${config.model} at ${config.baseUrl}, but the live endpoint call is not connected yet.`,
    lineExplanations: [],
    tokens: [],
    concepts: [],
    warnings: [
      {
        code: "PARTIAL_PARSE",
        message:
          "OpenAI-compatible request building is connected, but the live endpoint request/response bridge is not implemented yet.",
      },
    ],
    rawText: JSON.stringify(
      {
        endpoint: `${config.baseUrl}/chat/completions`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: config.apiKey ? "Bearer ***" : undefined,
        },
        body: requestBody,
      },
      null,
      2,
    ),
    createdAt: new Date().toISOString(),
  };
}

function normalizeOpenAICompatibleResponse(
  rawResponse: string,
  request: AgentAnalyzeRequest,
  config: OpenAICompatibleConfig,
  requestBody: OpenAICompatibleRequestBody,
): AgentAnalyzeResponse {
  const content = extractOpenAICompatibleContent(rawResponse) ?? rawResponse;
  const parsed = parseOpenAICompatiblePayload(content);

  if (!parsed) {
    return {
      providerId: "openai-compatible",
      language: request.detectedLanguage ?? "unknown",
      summary:
        `OpenAI-compatible endpoint for ${config.model} at ${config.baseUrl} returned a payload that Nunopi could not normalize.`,
      lineExplanations: [],
      tokens: [],
      concepts: [],
      warnings: [
        {
          code: "PARSE_FAILED",
          message:
            "OpenAI-compatible output could not be normalized into AgentAnalyzeResponse. Check the response content or JSON contract.",
        },
      ],
      rawText: JSON.stringify(
        {
          request: requestBody,
          rawResponse,
        },
        null,
        2,
      ),
      createdAt: new Date().toISOString(),
    };
  }

  return {
    providerId: "openai-compatible",
    language: parsed.language ?? request.detectedLanguage ?? "unknown",
    summary:
      parsed.summary ??
      `OpenAI-compatible endpoint for ${config.model} at ${config.baseUrl} returned a normalized payload.`,
    lineExplanations: parsed.lineExplanations ?? [],
    tokens: [],
    concepts: [],
    warnings: parsed.warnings ?? [],
    rawText: rawResponse,
    createdAt: new Date().toISOString(),
  };
}

function resolveOpenAICompatibleConfig(
  request: AgentAnalyzeRequest,
): OpenAICompatibleConfig {
  return {
    baseUrl: normalizeBaseUrl(
      process.env.NUNOPI_OPENAI_COMPAT_BASE_URL?.trim() || "http://localhost:11434/v1",
    ),
    model:
      process.env.NUNOPI_OPENAI_COMPAT_MODEL?.trim() || "hermes-3",
    apiKey: process.env.NUNOPI_OPENAI_COMPAT_API_KEY?.trim() || undefined,
    timeoutMs: request.options?.timeoutMs ?? 20_000,
  };
}

function buildOpenAICompatibleRequestBody(
  request: AgentAnalyzeRequest,
  config: OpenAICompatibleConfig,
): OpenAICompatibleRequestBody {
  return {
    model: config.model,
    messages: buildOpenAICompatibleMessages(request),
    temperature: 0.2,
    response_format: {
      type: "json_object",
    },
  };
}

function buildOpenAICompatibleMessages(
  request: AgentAnalyzeRequest,
): OpenAICompatibleMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are Nunopi's OpenAI-compatible analysis provider.",
        "Explain unfamiliar code for a beginner in Korean.",
        "Return JSON only.",
        "Expected JSON shape:",
        "{",
        '  "summary": "string",',
        '  "language": "string",',
        '  "lineExplanations": [',
        "    {",
        '      "line": number,',
        '      "code": "string",',
        '      "explanation": "string",',
        '      "tokenIds": string[],',
        '      "conceptIds": string[],',
        '      "confidence": number',
        "    }",
        "  ],",
        '  "warnings": [{ "code": "PARTIAL_PARSE | UNKNOWN_LANGUAGE | PARSE_FAILED | TOO_LONG", "message": "string" }]',
        "}",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Locale: ${request.locale}`,
        `Requested provider: ${request.providerId}`,
        `Detected language: ${request.detectedLanguage ?? "unknown"}`,
        `User intent: ${request.userIntent ?? "Explain the code in beginner-friendly Korean."}`,
        "",
        "Code to analyze:",
        "```",
        request.code,
        "```",
      ].join("\n"),
    },
  ];
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function extractOpenAICompatibleContent(rawResponse: string): string | null {
  try {
    const parsed = JSON.parse(rawResponse) as OpenAICompatibleChatCompletionResponse;
    const firstContent = parsed.choices?.[0]?.message?.content;

    if (typeof firstContent === "string") {
      return firstContent;
    }

    if (Array.isArray(firstContent)) {
      return firstContent
        .map((item) => (item.type === "text" && typeof item.text === "string" ? item.text : ""))
        .filter(Boolean)
        .join("\n");
    }

    return null;
  } catch {
    return null;
  }
}

function parseOpenAICompatiblePayload(
  rawText: string,
): OpenAICompatibleNormalizedPayload | null {
  const jsonCandidate = extractJsonCandidate(rawText);

  if (!jsonCandidate) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonCandidate);

    if (!isOpenAICompatibleNormalizedPayload(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function extractJsonCandidate(rawText: string): string | null {
  const jsonBlockMatch = rawText.match(/```json\s*([\s\S]*?)```/i);

  if (jsonBlockMatch?.[1]) {
    return jsonBlockMatch[1].trim();
  }

  const trimmed = rawText.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  return null;
}

function isOpenAICompatibleNormalizedPayload(
  value: unknown,
): value is OpenAICompatibleNormalizedPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (value.summary !== undefined && typeof value.summary !== "string") {
    return false;
  }

  if (value.language !== undefined && typeof value.language !== "string") {
    return false;
  }

  if (
    value.lineExplanations !== undefined &&
    !isLineExplanationList(value.lineExplanations)
  ) {
    return false;
  }

  if (value.warnings !== undefined && !isWarningList(value.warnings)) {
    return false;
  }

  return true;
}

function isLineExplanationList(
  value: unknown,
): value is AgentAnalyzeResponse["lineExplanations"] {
  return Array.isArray(value) && value.every(isLineExplanation);
}

function isLineExplanation(
  value: unknown,
): value is AgentAnalyzeResponse["lineExplanations"][number] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.line === "number" &&
    typeof value.code === "string" &&
    typeof value.explanation === "string" &&
    Array.isArray(value.tokenIds) &&
    value.tokenIds.every((item) => typeof item === "string") &&
    Array.isArray(value.conceptIds) &&
    value.conceptIds.every((item) => typeof item === "string") &&
    (value.confidence === undefined || typeof value.confidence === "number")
  );
}

function isWarningList(value: unknown): value is TranslateWarning[] {
  return Array.isArray(value) && value.every(isWarning);
}

function isWarning(value: unknown): value is TranslateWarning {
  if (!isRecord(value)) {
    return false;
  }

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
