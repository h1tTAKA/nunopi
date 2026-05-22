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
    code: "INVALID_REQUEST" | "PROVIDER_NOT_FOUND" | "PROVIDER_FAILED";
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

export async function POST(
  request: Request,
): Promise<Response> {
  const body = await safeReadJson(request);

  if (!body.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: body.message,
        },
      } satisfies AgentAnalyzeErrorResponse,
      { status: 400 },
    );
  }

  const parsedRequest = parseAnalyzeHttpRequest(body.value);

  if (!parsedRequest) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Request body must include providerId and a valid analyze request.",
        },
      } satisfies AgentAnalyzeErrorResponse,
      { status: 400 },
    );
  }

  const provider = resolveProvider(parsedRequest.providerId);

  if (!provider.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "PROVIDER_NOT_FOUND",
          message: provider.message,
          providerId: parsedRequest.providerId,
        },
      } satisfies AgentAnalyzeErrorResponse,
      { status: 404 },
    );
  }

  try {
    const providerRequest: AgentAnalyzeRequest = {
      ...parsedRequest.request,
      providerId: parsedRequest.providerId,
    };
    const response = await provider.provider.analyze(providerRequest);

    return Response.json({
      ok: true,
      providerId: parsedRequest.providerId,
      response,
    } satisfies AgentAnalyzeSuccessResponse);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "PROVIDER_FAILED",
          message: formatErrorMessage(error),
          providerId: parsedRequest.providerId,
        },
      } satisfies AgentAnalyzeErrorResponse,
      { status: 500 },
    );
  }
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
    !isRecord(request)
  ) {
    return null;
  }

  if (
    typeof request.code !== "string" ||
    request.code.trim().length === 0 ||
    request.locale !== "ko"
  ) {
    return null;
  }

  if (
    request.providerId !== undefined &&
    request.providerId !== providerId
  ) {
    return null;
  }

  return {
    providerId,
    request: request as AgentAnalyzeRequest,
  };
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

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Provider analyze call failed.";
}
