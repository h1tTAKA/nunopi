import { spawn } from "node:child_process";
import { access, readFile, unlink } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { randomUUID } from "node:crypto";

import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentProvider } from "./types";
import type { TranslateWarning } from "@/lib/translator/types";

const CODEX_COMMAND_CANDIDATES = ["codex", "codex.cmd", "codex.exe"] as const;
const JSON_CODE_BLOCK_PATTERN = /```json\s*([\s\S]*?)```/i;

interface CodexAvailabilityResult {
  available: boolean;
  commandPath?: string;
  message: string;
}

interface CodexNormalizedPayload {
  summary?: string;
  language?: string;
  lineExplanations?: AgentAnalyzeResponse["lineExplanations"];
  warnings?: TranslateWarning[];
}

export const codexAgentProvider: AgentProvider = {
  metadata: {
    id: "codex-agent",
    label: "Codex Agent",
    description:
      "Provider scaffold for OpenAI Codex CLI or app-server based analysis in the user's local environment.",
    executionLocation: "local-server",
    dataHandling: "remote-provider",
    capabilities: {
      streaming: false,
      cancellation: false,
      fileSystemAccess: false,
      shellAccess: true,
      requiresApiKey: false,
      requiresLocalProcess: true,
    },
  },
  async analyze(request: AgentAnalyzeRequest): Promise<AgentAnalyzeResponse> {
    const availability = await detectCodexAvailability(request);

    if (!availability.available) {
      return {
        providerId: "codex-agent",
        language: request.detectedLanguage ?? "unknown",
        summary:
          "Codex Agent provider is registered, but a local Codex runtime was not detected in this environment.",
        lineExplanations: [],
        tokens: [],
        concepts: [],
        warnings: [
          {
            code: "PARTIAL_PARSE",
            message: availability.message,
          },
        ],
        createdAt: new Date().toISOString(),
      };
    }

    const prompt = buildCodexPrompt(request);
    const mockText = process.env.NUNOPI_CODEX_MOCK_RESPONSE?.trim();

    if (mockText) {
      return normalizeCodexOutput(mockText, request, availability, prompt);
    }

    try {
      const rawText = await runCodexExec(availability.commandPath!, prompt);
      return normalizeCodexOutput(rawText, request, availability, prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : "codex exec failed";
      return {
        providerId: "codex-agent",
        language: request.detectedLanguage ?? "unknown",
        summary: `Codex exec failed: ${message}`,
        lineExplanations: [],
        tokens: [],
        concepts: [],
        warnings: [{ code: "PARSE_FAILED", message }],
        createdAt: new Date().toISOString(),
      };
    }
  },
};

async function runCodexExec(commandPath: string, prompt: string): Promise<string> {
  const tmpFile = join(tmpdir(), `nunopi-codex-${randomUUID()}.txt`);
  const TIMEOUT_MS = 60_000;

  return new Promise((resolve, reject) => {
    const proc = spawn(
      commandPath,
      [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "-s", "read-only",
        "--output-last-message", tmpFile,
        prompt,
      ],
      { env: { ...process.env } },
    );

    let stderr = "";
    let timedOut = false;
    const MAX_STDERR = 2_048;

    // spawn() ignores timeout option — implement manually
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, TIMEOUT_MS);

    proc.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_STDERR) {
        stderr += chunk.toString().slice(0, MAX_STDERR - stderr.length);
      }
    });
    proc.on("error", (err) => { clearTimeout(timer); unlink(tmpFile).catch(() => {}); reject(err); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      readFile(tmpFile, "utf-8")
        .then((text) => {
          unlink(tmpFile).catch(() => {});
          resolve(text.trim());
        })
        .catch((readErr: NodeJS.ErrnoException) => {
          unlink(tmpFile).catch(() => {});
          const reason = timedOut
            ? `codex exec timed out after ${TIMEOUT_MS / 1000}s`
            : readErr.code === "ENOENT"
            ? `codex exec produced no output (exit code: ${code ?? "unknown"})`
            : `codex exec failed (exit code: ${code ?? "unknown"}). stderr: ${stderr.slice(0, 300)}`;
          reject(new Error(reason));
        });
    });
  });
}

function buildCodexPrompt(request: AgentAnalyzeRequest): string {
  return [
    "You are Nunopi's Codex analysis provider.",
    "Explain unfamiliar code for a beginner in Korean.",
    "Return JSON only.",
    "",
    "Output JSON shape:",
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
    "",
    `Locale: ${request.locale}`,
    `Requested provider: ${request.providerId}`,
    `Detected language: ${request.detectedLanguage ?? "unknown"}`,
    `User intent: ${request.userIntent ?? "Explain the code in beginner-friendly Korean."}`,
    "",
    "Code to analyze:",
    "```",
    request.code,
    "```",
  ].join("\n");
}

function buildPendingCodexResponse(
  request: AgentAnalyzeRequest,
  availability: CodexAvailabilityResult,
  prompt: string,
): AgentAnalyzeResponse {
  return {
    providerId: "codex-agent",
    language: request.detectedLanguage ?? "unknown",
    summary: `Codex runtime detected at ${availability.commandPath}, and Nunopi prepared a prompt/response contract for live Codex analysis.`,
    lineExplanations: [],
    tokens: [],
    concepts: [],
    warnings: [
      {
        code: "PARTIAL_PARSE",
        message:
          "Codex runtime is available, but the live Codex CLI or app-server bridge is not implemented yet.",
      },
    ],
    rawText: prompt,
    createdAt: new Date().toISOString(),
  };
}

function normalizeCodexOutput(
  rawText: string,
  request: AgentAnalyzeRequest,
  availability: CodexAvailabilityResult,
  prompt: string,
): AgentAnalyzeResponse {
  const parsed = parseCodexPayload(rawText);

  if (!parsed) {
    return {
      providerId: "codex-agent",
      language: request.detectedLanguage ?? "unknown",
      summary: `Codex runtime detected at ${availability.commandPath}, but the returned payload did not match Nunopi's expected JSON schema.`,
      lineExplanations: [],
      tokens: [],
      concepts: [],
      warnings: [
        {
          code: "PARSE_FAILED",
          message:
            "Codex output could not be normalized into AgentAnalyzeResponse. Check the prompt contract or raw payload shape.",
        },
      ],
      rawText: `${prompt}\n\n--- RAW RESPONSE ---\n${rawText}`,
      createdAt: new Date().toISOString(),
    };
  }

  return {
    providerId: "codex-agent",
    language: parsed.language ?? request.detectedLanguage ?? "unknown",
    summary:
      parsed.summary ??
      `Codex runtime detected at ${availability.commandPath}, and a normalized Codex payload was returned.`,
    lineExplanations: parsed.lineExplanations ?? [],
    tokens: [],
    concepts: [],
    warnings: parsed.warnings ?? [],
    rawText,
    createdAt: new Date().toISOString(),
  };
}

function parseCodexPayload(rawText: string): CodexNormalizedPayload | null {
  const jsonCandidate = extractJsonCandidate(rawText);

  if (!jsonCandidate) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonCandidate);

    if (!isCodexNormalizedPayload(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function extractJsonCandidate(rawText: string): string | null {
  const blockMatch = rawText.match(JSON_CODE_BLOCK_PATTERN);

  if (blockMatch?.[1]) {
    return blockMatch[1].trim();
  }

  const trimmed = rawText.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  return null;
}

function isCodexNormalizedPayload(value: unknown): value is CodexNormalizedPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (value.summary !== undefined && typeof value.summary !== "string") {
    return false;
  }

  if (value.language !== undefined && typeof value.language !== "string") {
    return false;
  }

  if (value.lineExplanations !== undefined && !isLineExplanationList(value.lineExplanations)) {
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

async function detectCodexAvailability(request?: AgentAnalyzeRequest): Promise<CodexAvailabilityResult> {
  const explicitCommand =
    request?.providerSettings?.["codex-agent"]?.cliPath?.trim() ||
    process.env.NUNOPI_CODEX_COMMAND?.trim();

  if (explicitCommand) {
    const exists = await isExecutableFile(explicitCommand);

    if (exists) {
      return {
        available: true,
        commandPath: explicitCommand,
        message: `Codex runtime detected at ${explicitCommand}.`,
      };
    }

    return {
      available: false,
      message:
        "NUNOPI_CODEX_COMMAND is set, but the target file does not exist or is not executable.",
    };
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of pathEntries) {
    for (const command of CODEX_COMMAND_CANDIDATES) {
      const candidatePath = join(entry, command);

      if (await isExecutableFile(candidatePath)) {
        return {
          available: true,
          commandPath: candidatePath,
          message: `Codex runtime detected at ${candidatePath}.`,
        };
      }
    }
  }

  return {
    available: false,
    message:
      "Codex runtime was not found in PATH. Install the Codex CLI or set NUNOPI_CODEX_COMMAND to a valid executable path.",
  };
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}
