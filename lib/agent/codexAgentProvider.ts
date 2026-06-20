import { spawn } from "node:child_process";
import { access, readFile, unlink } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { randomUUID } from "node:crypto";

import type { AgentAnalyzeRequest, AgentAnalyzeResponse, AgentUsage } from "./schema";
import type { AgentAnalyzeCallOptions, AgentProvider } from "./types";
import { dedupeConcepts, dedupeTokens } from "./dedupe";
import { buildTextPrompt, normalizeTextOutput, textModeResponse } from "./textMode";
import { buildExplainTokenPrompt, normalizeExplainTokenOutput, tokenModeResponse } from "./tokenMode";
import { buildExplainConceptPrompt, normalizeExplainConceptOutput, conceptModeResponse } from "./conceptMode";
import { buildChatPrompt, normalizeChatOutput, chatModeResponse } from "./chatMode";
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
  title?: string;
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
    const isText = request.mode === "text";
    const isExplainToken = request.mode === "explain-token";
    const isExplainConcept = request.mode === "explain-concept";
    const isChat = request.mode === "chat";

    if (!availability.available) {
      if (isChat) {
        return chatModeResponse("codex-agent", `Codex 런타임을 찾지 못했다: ${availability.message}`, [
          { code: "PARTIAL_PARSE", message: availability.message },
        ]);
      }
      if (isExplainConcept) {
        return conceptModeResponse("codex-agent", [], [
          { code: "PARTIAL_PARSE", message: availability.message },
        ]);
      }
      if (isExplainToken) {
        return tokenModeResponse("codex-agent", [], [
          { code: "PARTIAL_PARSE", message: availability.message },
        ]);
      }
      if (isText) {
        return textModeResponse("codex-agent", availability.message, [
          { code: "PARTIAL_PARSE", message: availability.message },
        ]);
      }
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

    const prompt = isChat
      ? buildChatPrompt(request)
      : isExplainConcept
        ? buildExplainConceptPrompt(request)
        : isExplainToken
          ? buildExplainTokenPrompt(request)
          : isText
            ? buildTextPrompt(request)
            : buildCodexPrompt(request);
    const mockText = process.env.NUNOPI_CODEX_MOCK_RESPONSE?.trim();

    if (mockText) {
      return isChat
        ? normalizeChatOutput(mockText, "codex-agent")
        : isExplainConcept
          ? normalizeExplainConceptOutput(mockText, "codex-agent", request)
          : isExplainToken
            ? normalizeExplainTokenOutput(mockText, "codex-agent", request)
            : isText
              ? normalizeTextOutput(mockText, "codex-agent", request)
              : normalizeCodexOutput(mockText, request, availability, prompt);
    }

    try {
      const { text: rawText, usage } = await runCodexExec(
        availability.commandPath!,
        prompt,
        options?.signal,
        options?.onProgress,
      );
      return isChat
        ? normalizeChatOutput(rawText, "codex-agent")
        : isExplainConcept
          ? normalizeExplainConceptOutput(rawText, "codex-agent", request)
          : isExplainToken
            ? normalizeExplainTokenOutput(rawText, "codex-agent", request)
            : isText
              ? normalizeTextOutput(rawText, "codex-agent", request, usage)
              : normalizeCodexOutput(rawText, request, availability, prompt, usage);
    } catch (err) {
      // 사용자 취소는 일반 실패가 아니므로 route로 전파한다(499 처리).
      if (options?.signal?.aborted) {
        throw err;
      }
      const message = err instanceof Error ? err.message : "codex exec failed";
      if (isChat) {
        return chatModeResponse("codex-agent", `Codex 응답 실패: ${message}`, [{ code: "PARSE_FAILED", message }]);
      }
      if (isExplainConcept) {
        return conceptModeResponse("codex-agent", [], [{ code: "PARSE_FAILED", message }]);
      }
      if (isExplainToken) {
        return tokenModeResponse("codex-agent", [], [{ code: "PARSE_FAILED", message }]);
      }
      if (isText) {
        return textModeResponse("codex-agent", `Codex exec failed: ${message}`, [
          { code: "PARSE_FAILED", message },
        ]);
      }
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

interface CodexEvent {
  type?: string;
  item?: { type?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
}

// 파싱된 codex --json 이벤트를 사람이 읽을 진행 라벨로 변환한다.
function codexEventLabel(event: CodexEvent): string | null {
  switch (event.type) {
    case "thread.started":
      return "세션 시작…";
    case "turn.started":
      return "분석 시작…";
    case "item.started":
      return "처리 중…";
    case "item.completed":
      return event.item?.type === "agent_message" ? "응답 정리 중…" : "단계 완료…";
    case "turn.completed":
      return event.usage?.output_tokens != null
        ? `완료 (출력 ${event.usage.output_tokens} 토큰)`
        : "완료…";
    default:
      return event.type ?? null;
  }
}

interface CodexExecResult {
  text: string;
  usage?: AgentUsage;
}

async function runCodexExec(
  commandPath: string,
  prompt: string,
  signal?: AbortSignal,
  onProgress?: (line: string) => void,
): Promise<CodexExecResult> {
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
        // 진행 이벤트를 JSONL로 stdout에 flush한다. (--json 없이는 인간용 로그가
        // 파이프에서 블록버퍼링돼 실시간으로 안 흐른다.) 최종 결과는 tmpfile에서 읽음.
        "--json",
        "--output-last-message", tmpFile,
        prompt,
      ],
      // prompt는 positional 인자로 넘긴다. stdin을 열어두면 codex exec가
      // 추가 입력(stdin EOF)을 기다리며 멈춘다 → "ignore"로 자식 stdin을 닫는다.
      { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
    );

    let stderr = "";
    let aborted = false;
    let usage: AgentUsage | undefined;
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

    // stdout은 --json으로 흘러오는 진행 이벤트(JSONL). 최종 결과는 tmpfile에서
    // 읽으므로 stdout은 진행 표시용. 완성된 줄만 읽기 좋은 라벨로 onProgress 전달.
    let stdoutBuf = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let event: CodexEvent;
        try {
          event = JSON.parse(trimmed) as CodexEvent;
        } catch {
          onProgress?.(trimmed);
          continue;
        }
        if (event.type === "turn.completed" && event.usage) {
          usage = {
            inputTokens: event.usage.input_tokens,
            outputTokens: event.usage.output_tokens,
          };
        }
        if (onProgress) {
          const label = codexEventLabel(event);
          if (label) onProgress(label);
        }
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
          resolve({ text: text.trim(), usage });
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
    '  "title": "string (이 코드의 핵심을 압축한 짧은 한국어 명사구 제목. 문장/마침표 금지, 6~24자, 구체적으로. 예: \\"유저 역할별 그룹화 유틸\\")",',
    '  "summary": "string",',
    '  "language": "string",',
    '  "lineExplanations": [',
    "    {",
    '      "line": number,',
    '      "code": "string",',
    '      "explanation": "string (ONE short sentence)",',
    '      "tokens": ["string", ...] (every meaningful token TEXT on this line: identifiers, keywords, operators, punctuation),',
    '      "conceptIds": string[]',
    "    }",
    "  ],",
    '  "concepts": [',
    '    { "conceptId": "string", "title": "string (Korean)", "lines": number[], "count": number }',
    "  ],",
    '  "warnings": [{ "code": "PARTIAL_PARSE | UNKNOWN_LANGUAGE | PARSE_FAILED | TOO_LONG", "message": "string" }]',
    "}",
    "",
    "Do NOT produce a token dictionary. Only list each line's token TEXTS in lineExplanations[].tokens — their descriptions are fetched later on demand. This keeps output small and fast.",
    "lineExplanations.conceptIds must reference concepts[].conceptId. Populate concepts with higher-level ideas (e.g. React state).",
    "Give one lineExplanations entry for EVERY meaningful line — do not skip or omit lines. Each line explanation is ONE short sentence; summary is 2-3 sentences. Do not pad.",
    "Each concept conceptId must be UNIQUE. Only include a PARTIAL_PARSE warning if input was truncated; otherwise empty warnings.",
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
  usage?: AgentUsage,
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
    mode: "code",
    language: parsed.language ?? request.detectedLanguage ?? "unknown",
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : undefined,
    summary:
      parsed.summary ??
      `Codex runtime detected at ${availability.commandPath}, and a normalized Codex payload was returned.`,
    lineExplanations: Array.isArray(parsed.lineExplanations)
      ? parsed.lineExplanations.filter(isLineExplanation)
      : [],
    tokens: dedupeTokens(
      Array.isArray(parsed.tokens) ? parsed.tokens.filter(isCodeToken) : [],
    ),
    concepts: dedupeConcepts(
      Array.isArray(parsed.concepts) ? parsed.concepts.filter(isConceptOccurrence) : [],
    ),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(isWarning) : [],
    usage,
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

  // lineExplanations도 배열 여부만 느슨히 검사하고, 요소 검증은 normalize의 filter로 처리한다
  // (줄설명 하나가 conceptIds 누락 등으로 어긋나도 요약·나머지 줄을 통째로 잃지 않게).
  if (value.lineExplanations !== undefined && !Array.isArray(value.lineExplanations)) {
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

  // warnings도 배열인지만 느슨히 검사하고, 요소 검증은 normalize의 filter로 처리한다
  // (형식 안 맞는 warning 하나로 요약·줄별 설명을 통째로 잃지 않게).
  if (value.warnings !== undefined && !Array.isArray(value.warnings)) {
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


function isLineExplanation(
  value: unknown,
): value is AgentAnalyzeResponse["lineExplanations"][number] {
  if (!isRecord(value)) {
    return false;
  }

  const stringArrayOrUndefined = (v: unknown) =>
    v === undefined || (Array.isArray(v) && v.every((item) => typeof item === "string"));
  return (
    typeof value.line === "number" &&
    typeof value.code === "string" &&
    typeof value.explanation === "string" &&
    stringArrayOrUndefined(value.tokens) &&
    stringArrayOrUndefined(value.tokenIds) &&
    Array.isArray(value.conceptIds) &&
    value.conceptIds.every((item) => typeof item === "string") &&
    (value.confidence === undefined || typeof value.confidence === "number")
  );
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
