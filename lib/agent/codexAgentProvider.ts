import { spawn } from "node:child_process";
import { access, readFile, unlink } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { randomUUID } from "node:crypto";

import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { AgentAnalyzeCallOptions, AgentProvider } from "./types";
import { dedupeConcepts, dedupeTokens } from "./dedupe";
import type { CodeToken, ConceptOccurrence, TranslateWarning } from "@/lib/translator/types";

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
  tokens?: unknown[];
  concepts?: unknown[];
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
      cancellation: true,
      fileSystemAccess: false,
      shellAccess: true,
      requiresApiKey: false,
      requiresLocalProcess: true,
    },
  },
  async analyze(
    request: AgentAnalyzeRequest,
    options?: AgentAnalyzeCallOptions,
  ): Promise<AgentAnalyzeResponse> {
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
      const rawText = await runCodexExec(availability.commandPath!, prompt, options?.signal);
      return normalizeCodexOutput(rawText, request, availability, prompt);
    } catch (err) {
      // 사용자 취소는 일반 실패가 아니므로 route로 전파한다(499 처리).
      if (options?.signal?.aborted) {
        throw err;
      }
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

async function runCodexExec(
  commandPath: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const tmpFile = join(tmpdir(), `nunopi-codex-${randomUUID()}.txt`);

  return new Promise((resolve, reject) => {
    // 시간 제한 없음 — 유저가 멈추기를 누르면 signal로 프로세스를 죽인다.
    if (signal?.aborted) {
      unlink(tmpFile).catch(() => {});
      reject(new Error("분석이 취소되었습니다."));
      return;
    }

    const proc = spawn(
      commandPath,
      [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "-s", "read-only",
        // 학습용 코드 설명엔 high 추론이 과해 느리다. low로 호출 단위
        // 오버라이드(유저 config.toml은 안 건드림).
        "-c", "model_reasoning_effort=low",
        "--output-last-message", tmpFile,
        prompt,
      ],
      // prompt는 positional 인자로 넘긴다. stdin을 열어두면 codex exec가
      // 추가 입력(stdin EOF)을 기다리며 멈춘다 → "ignore"로 자식 stdin을 닫는다.
      { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
    );

    let stderr = "";
    let aborted = false;
    const MAX_STDERR = 2_048;

    const onAbort = () => {
      aborted = true;
      proc.kill();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    proc.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_STDERR) {
        stderr += chunk.toString().slice(0, MAX_STDERR - stderr.length);
      }
    });
    proc.on("error", (err) => { cleanup(); unlink(tmpFile).catch(() => {}); reject(err); });
    proc.on("close", (code) => {
      cleanup();
      if (aborted) {
        unlink(tmpFile).catch(() => {});
        reject(new Error("분석이 취소되었습니다."));
        return;
      }
      readFile(tmpFile, "utf-8")
        .then((text) => {
          unlink(tmpFile).catch(() => {});
          resolve(text.trim());
        })
        .catch((readErr: NodeJS.ErrnoException) => {
          unlink(tmpFile).catch(() => {});
          const reason =
            readErr.code === "ENOENT"
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
    '  "tokens": [',
    "    {",
    '      "id": "string (referenced by lineExplanations.tokenIds)",',
    '      "token": "string (raw code token, e.g. useState)",',
    '      "category": "react_hook | state_variable | state_setter | prop | function | event_handler | jsx_element | operator | keyword | api_call | dependency_array | initial_value | css_selector | css_property | css_value | tailwind_utility | tailwind_layout | tailwind_spacing | tailwind_color | tailwind_responsive | tailwind_state",',
    '      "label": "string (short Korean name)",',
    '      "description": "string (beginner-friendly Korean explanation)",',
    '      "example": "string (optional usage example)",',
    '      "lines": number[],',
    '      "conceptId": "string (optional, references concepts.conceptId)",',
    '      "bookmarkable": boolean',
    "    }",
    "  ],",
    '  "concepts": [',
    '    { "conceptId": "string", "title": "string (Korean)", "lines": number[], "count": number }',
    "  ],",
    '  "warnings": [{ "code": "PARTIAL_PARSE | UNKNOWN_LANGUAGE | PARSE_FAILED | TOO_LONG", "message": "string" }]',
    "}",
    "",
    "Link references: lineExplanations.tokenIds must reference tokens[].id, and lineExplanations.conceptIds must reference concepts[].conceptId.",
    "Populate tokens with the meaningful identifiers/keywords in the code, and concepts with the higher-level ideas (e.g. React state).",
    "Give one lineExplanations entry for EVERY meaningful line of the code — do not skip or omit lines, even for long inputs.",
    "Each token id and each concept conceptId must be UNIQUE across the whole response (no duplicates).",
    "Only include a PARTIAL_PARSE warning if the input was actually truncated; otherwise return an empty warnings array.",
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
    tokens: dedupeTokens(
      Array.isArray(parsed.tokens) ? parsed.tokens.filter(isCodeToken) : [],
    ),
    concepts: dedupeConcepts(
      Array.isArray(parsed.concepts) ? parsed.concepts.filter(isConceptOccurrence) : [],
    ),
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

  // tokens/concepts는 배열인지만 느슨히 검사한다. 요소 단위 검증은 normalize에서
  // filter로 처리해, 토큰 하나가 어긋나도 요약·줄별 설명까지 통째로 잃지 않게 한다.
  if (value.tokens !== undefined && !Array.isArray(value.tokens)) {
    return false;
  }

  if (value.concepts !== undefined && !Array.isArray(value.concepts)) {
    return false;
  }

  if (value.warnings !== undefined && !isWarningList(value.warnings)) {
    return false;
  }

  return true;
}

function isCodeToken(value: unknown): value is CodeToken {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.token === "string" &&
    typeof value.category === "string" &&
    typeof value.label === "string" &&
    typeof value.description === "string" &&
    (value.example === undefined || typeof value.example === "string") &&
    Array.isArray(value.lines) &&
    value.lines.every((line) => typeof line === "number") &&
    (value.conceptId === undefined || typeof value.conceptId === "string") &&
    typeof value.bookmarkable === "boolean"
  );
}

function isConceptOccurrence(value: unknown): value is ConceptOccurrence {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.conceptId === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.lines) &&
    value.lines.every((line) => typeof line === "number") &&
    typeof value.count === "number"
  );
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
