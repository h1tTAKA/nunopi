import {
  createAgentRegistry,
  type AgentAnalyzeRequest,
  type AgentAnalyzeResponse,
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

  const registry = createAgentRegistry();
  const provider = registry.getProvider(parsedRequest.providerId);

  if (!provider) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "PROVIDER_NOT_FOUND",
          message: `Provider not found: ${parsedRequest.providerId}`,
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
    const response = await provider.analyze(providerRequest);

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

  if (typeof providerId !== "string" || !isRecord(request)) {
    return null;
  }

  if (
    typeof request.code !== "string" ||
    request.code.trim().length === 0 ||
    request.locale !== "ko"
  ) {
    return null;
  }

  return {
    providerId: providerId as AgentProviderKind,
    request: request as AgentAnalyzeRequest,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Provider analyze call failed.";
}
