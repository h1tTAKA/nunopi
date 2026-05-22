import {
  createAgentRegistry,
  type AgentAnalyzeRequest,
  type AgentAnalyzeResponse,
  type AgentProvider,
  type AgentProviderKind,
} from "@/lib/agent";

interface AgentAnalyzeHttpRequest {
  providerId: AgentProviderKind;
  request: AgentAnalyzeRequest;
}

interface AgentAnalyzeSuccessResponse {
  ok: true;
  providerId: AgentProviderKind;
  response: AgentAnalyzeResponse;
}

interface AgentAnalyzeErrorResponse {
  ok: false;
  error: {
    code:
      | "INVALID_REQUEST"
      | "PROVIDER_NOT_FOUND"
      | "PROVIDER_TIMEOUT"
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

const PROVIDER_TIMEOUT_MS = 8_000;
const ALLOW_HEADER = "POST, OPTIONS";

class ProviderTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Provider did not respond within ${timeoutMs}ms.`);
    this.name = "ProviderTimeoutError";
  }
}

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

  try {
    const providerRequest: AgentAnalyzeRequest = {
      ...parsedRequest.request,
      providerId: parsedRequest.providerId,
    };
    const response = await runWithTimeout(
      provider.provider.analyze(providerRequest),
      PROVIDER_TIMEOUT_MS,
    );

    return jsonSuccess(parsedRequest.providerId, response);
  } catch (error) {
    if (error instanceof ProviderTimeoutError) {
      return jsonError(
        504,
        "PROVIDER_TIMEOUT",
        error.message,
        parsedRequest.providerId,
      );
    }

    return jsonError(
      500,
      "PROVIDER_FAILED",
      formatErrorMessage(error),
      parsedRequest.providerId,
    );
  }
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

  if (
    value.providerId !== undefined &&
    value.providerId !== providerId
  ) {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAgentProviderKind(value: string): value is AgentProviderKind {
  return ALLOWED_PROVIDER_IDS.includes(value as AgentProviderKind);
}

function resolveProvider(
  providerId: AgentProviderKind,
):
  | { ok: true; provider: AgentProvider }
  | { ok: false; message: string } {
  const registry = createAgentRegistry();
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

async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new ProviderTimeoutError(timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function jsonSuccess(
  providerId: AgentProviderKind,
  response: AgentAnalyzeResponse,
): Response {
  return Response.json({
    ok: true,
    providerId,
    response,
  } satisfies AgentAnalyzeSuccessResponse);
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
