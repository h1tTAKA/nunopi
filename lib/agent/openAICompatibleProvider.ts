import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProvider } from "./types";

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

    return {
      providerId: this.metadata.id,
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
  },
};

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
