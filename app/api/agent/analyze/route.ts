import {
  analyzeCodeChunked,
  claudeAgentProvider,
  codexAgentProvider,
  createAgentRegistry,
  localRulesProvider,
  openAICompatibleProvider,
  shouldChunkCodeAnalysis,
  type AgentAnalyzeRequest,
  type AgentAnalyzeResponse,
  type AgentProvider,
  type AgentProviderKind,
} from "@/lib/agent";

interface AgentAnalyzeHttpRequest {
  providerId: AgentProviderKind;
  request: AgentAnalyzeRequest;
}

interface AgentAnalyzeErrorResponse {
  ok: false;
  error: {
    code:
      | "INVALID_REQUEST"
      | "PROVIDER_NOT_FOUND"
      | "PROVIDER_FAILED";
    message: string;
    providerId?: string;
  };
}

const ALLOWED_PROVIDER_IDS: AgentProviderKind[] = [
  "local-rules",
  "claude-agent",
  "codex-agent",
  "openai-app-server",
  "openai-api-key",
  "hermes-local",
  "openai-compatible",
  "mock",
];

const ALLOWED_LANGUAGES = [
  "react",
  "typescript",
  "javascript",
  "css",
  "tailwindcss",
  "unknown",
] as const;
const ALLOW_HEADER = "POST, OPTIONS";

export async function POST(
  request: Request,
): Promise<Response> {
  const body = await safeReadJson(request);

  if (!body.ok) {
    return jsonError(400, "INVALID_REQUEST", body.message);
  }

  const parsedRequest = parseAnalyzeHttpRequest(body.value);

  if (!parsedRequest) {
    return jsonError(
      400,
      "INVALID_REQUEST",
      "Request body must include providerId and a valid analyze request.",
    );
  }

  const provider = resolveProvider(parsedRequest.providerId);

  if (!provider.ok) {
    return jsonError(
      404,
      "PROVIDER_NOT_FOUND",
      provider.message,
      parsedRequest.providerId,
    );
  }

  const providerRequest: AgentAnalyzeRequest = {
    ...parsedRequest.request,
    providerId: parsedRequest.providerId,
  };
  const providerId = parsedRequest.providerId;

  // 진행 상황을 실시간으로 흘리기 위해 NDJSON(줄마다 JSON 1개) 스트림으로 응답한다.
  // 이벤트: {type:"progress",line} | {type:"result",providerId,response} | {type:"error",message}
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: unknown) => {
        // 클라이언트가 중간에 끊으면(취소) 스트림이 cancel돼 enqueue가 throw한다 → 무시.
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          /* stream already closed/cancelled */
        }
      };
      try {
        // 시간 제한 없음 — 클라이언트가 fetch를 abort하면 request.signal이 fire되어
        // provider가 진행 중인 CLI 프로세스/HTTP 요청을 중단한다.
        const callOptions = {
          signal: request.signal,
          onProgress: (line: string) => send({ type: "progress", line }),
          // 청크 분석 부분 결과 — 도착하는 족족 클라에 흘려 점진 표시.
          onPartial: (partial: AgentAnalyzeResponse) =>
            send({ type: "partial", providerId, response: partial }),
        };
        // 큰 코드(code 모드 + LLM provider)는 병렬 청크 2단계로 분석해 wall-clock을 줄인다.
        // 그 외는 기존 단일 호출 그대로(회귀 0).
        const response = shouldChunkCodeAnalysis(providerRequest, provider.provider)
          ? await analyzeCodeChunked(provider.provider, providerRequest, callOptions)
          : await provider.provider.analyze(providerRequest, callOptions);
        send({ type: "result", providerId, response });
      } catch (error) {
        const message = request.signal.aborted
          ? "분석이 취소되었습니다."
          : formatErrorMessage(error);
        send({ type: "error", message });
      } finally {
        // 클라이언트가 이미 끊었으면 controller가 닫힌 상태라 close()도 throw할 수 있다.
        try {
          controller.close();
        } catch {
          /* already closed/cancelled */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: ALLOW_HEADER,
    },
  });
}

async function safeReadJson(
  request: Request,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; message: string }
> {
  try {
    return {
      ok: true,
      value: await request.json(),
    };
  } catch {
    return {
      ok: false,
      message: "Request body must be valid JSON.",
    };
  }
}

function parseAnalyzeHttpRequest(value: unknown): AgentAnalyzeHttpRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  const providerId = value.providerId;
  const request = value.request;

  if (
    typeof providerId !== "string" ||
    !isAgentProviderKind(providerId) ||
    !isValidAnalyzeRequestPayload(request, providerId)
  ) {
    return null;
  }

  return {
    providerId,
    request,
  };
}

function isValidAnalyzeRequestPayload(
  value: unknown,
  providerId: AgentProviderKind,
): value is AgentAnalyzeRequest {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.code !== "string" ||
    value.code.trim().length === 0 ||
    value.locale !== "ko"
  ) {
    return false;
  }

  if (!isOptionalProviderId(value.providerId, providerId)) {
    return false;
  }

  if (!isOptionalDetectedLanguage(value.detectedLanguage)) {
    return false;
  }

  if (!isOptionalUserIntent(value.userIntent)) {
    return false;
  }

  if (
    value.mode !== undefined &&
    value.mode !== "code" &&
    value.mode !== "text" &&
    value.mode !== "explain-token" &&
    value.mode !== "explain-concept" &&
    value.mode !== "chat"
  ) {
    return false;
  }

  if (value.targetToken !== undefined && typeof value.targetToken !== "string") {
    return false;
  }

  if (value.targetConcept !== undefined && typeof value.targetConcept !== "string") {
    return false;
  }

  if (value.messages !== undefined && !isChatMessageList(value.messages)) {
    return false;
  }

  // 이어서 분석: 이전 부분 결과 객체. 상세 형태는 orchestrator가 ?? 가드로 안전 처리하므로
  // 여기선 객체 여부만 느슨히 검사.
  if (value.resumeFrom !== undefined && !isRecord(value.resumeFrom)) {
    return false;
  }

  if (!isOptionalAnalyzeOptions(value.options)) {
    return false;
  }

  if (!isOptionalProviderSettings(value.providerSettings)) {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isChatMessageList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (m) =>
        isRecord(m) &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
  );
}

function isOptionalProviderId(
  value: unknown,
  providerId: AgentProviderKind,
): boolean {
  return value === undefined || value === providerId;
}

function isOptionalDetectedLanguage(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "string" && isSupportedLanguage(value))
  );
}

function isOptionalUserIntent(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalAnalyzeOptions(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  if (value.maxLines !== undefined && !isPositiveInteger(value.maxLines)) {
    return false;
  }

  if (value.timeoutMs !== undefined && !isPositiveInteger(value.timeoutMs)) {
    return false;
  }

  if (
    (value.includeTokens !== undefined && typeof value.includeTokens !== "boolean") ||
    (value.includeConcepts !== undefined && typeof value.includeConcepts !== "boolean") ||
    (value.includeRawOutput !== undefined && typeof value.includeRawOutput !== "boolean")
  ) {
    return false;
  }

  return true;
}

function isOptionalProviderSettings(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;

  const oaic = value["openai-compatible"];
  if (oaic !== undefined) {
    if (!isRecord(oaic)) return false;
    const { baseUrl, model, apiKey } = oaic;
    if (
      (baseUrl !== undefined && typeof baseUrl !== "string") ||
      (model !== undefined && typeof model !== "string") ||
      (apiKey !== undefined && typeof apiKey !== "string")
    ) return false;
  }

  for (const key of ["claude-agent", "codex-agent"] as const) {
    const agent = value[key];
    if (agent !== undefined) {
      if (!isRecord(agent)) return false;
      const { cliPath } = agent as Record<string, unknown>;
      if (cliPath !== undefined && typeof cliPath !== "string") return false;
    }
  }

  return true;
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isSupportedLanguage(value: string): boolean {
  return ALLOWED_LANGUAGES.includes(
    value as (typeof ALLOWED_LANGUAGES)[number],
  );
}

function isAgentProviderKind(value: string): value is AgentProviderKind {
  return ALLOWED_PROVIDER_IDS.includes(value as AgentProviderKind);
}

function resolveProvider(
  providerId: AgentProviderKind,
):
  | { ok: true; provider: AgentProvider }
  | { ok: false; message: string } {
  const registry = createAgentRegistry({
    providers: [localRulesProvider, claudeAgentProvider, codexAgentProvider, openAICompatibleProvider],
  });
  const provider = registry.getProvider(providerId);

  if (!provider) {
    return {
      ok: false,
      message: `Provider not found: ${providerId}`,
    };
  }

  return {
    ok: true,
    provider,
  };
}

function jsonError(
  status: number,
  code: AgentAnalyzeErrorResponse["error"]["code"],
  message: string,
  providerId?: string,
): Response {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
        providerId,
      },
    } satisfies AgentAnalyzeErrorResponse,
    {
      status,
      headers: {
        Allow: ALLOW_HEADER,
      },
    },
  );
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Provider analyze call failed.";
}
