import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { delimiter, join } from "node:path";

import type { AgentAnalyzeRequest, AgentAnalyzeResponse, AgentUsage } from "./schema";
import type { AgentAnalyzeCallOptions, AgentProvider } from "./types";
import { dedupeConcepts, dedupeTokens } from "./dedupe";
import { buildTextPrompt, normalizeTextOutput, textModeResponse } from "./textMode";
import { buildExplainTokenPrompt, normalizeExplainTokenOutput, tokenModeResponse } from "./tokenMode";
import { buildExplainConceptPrompt, normalizeExplainConceptOutput, conceptModeResponse } from "./conceptMode";
import { CHAT_SYSTEM_PROMPT, buildChatPrompt, normalizeChatOutput, chatModeResponse } from "./chatMode";
import { codeChunkDirectives } from "./codeChunkPrompt";
import type { CodeToken, ConceptOccurrence, TranslateWarning } from "@/lib/translator/types";

const CLAUDE_COMMAND_CANDIDATES = ["claude", "claude.cmd", "claude.exe"] as const;
const JSON_CODE_BLOCK_PATTERN = /```json\s*([\s\S]*?)```/i;

interface ClaudeAvailabilityResult {
  available: boolean;
  commandPath?: string;
  message: string;
}

interface ClaudeNormalizedPayload {
  summary?: string;
  title?: string;
  language?: string;
  lineExplanations?: AgentAnalyzeResponse["lineExplanations"];
  tokens?: unknown[];
  concepts?: unknown[];
  warnings?: TranslateWarning[];
}

export const claudeAgentProvider: AgentProvider = {
  metadata: {
    id: "claude-agent",
    label: "Claude Agent",
    description:
      "Provider scaffold for Claude Agent SDK or Claude Code based analysis in the user's local environment.",
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
    const availability = await detectClaudeAvailability(request);
    const isText = request.mode === "text";
    const isExplainToken = request.mode === "explain-token";
    const isExplainConcept = request.mode === "explain-concept";
    const isChat = request.mode === "chat";

    if (!availability.available) {
      if (isChat) {
        return chatModeResponse("claude-agent", `Claude 런타임을 찾지 못했다: ${availability.message}`, [
          { code: "PARTIAL_PARSE", message: availability.message },
        ]);
      }
      if (isExplainConcept) {
        return conceptModeResponse("claude-agent", [], [
          { code: "PARTIAL_PARSE", message: availability.message },
        ]);
      }
      if (isExplainToken) {
        return tokenModeResponse("claude-agent", [], [
          { code: "PARTIAL_PARSE", message: availability.message },
        ]);
      }
      if (isText) {
        return textModeResponse("claude-agent", availability.message, [
          { code: "PARTIAL_PARSE", message: availability.message },
        ]);
      }
      return {
        providerId: this.metadata.id,
        language: request.detectedLanguage ?? "unknown",
        summary:
          "Claude Agent provider is registered, but a local Claude runtime was not detected in this environment.",
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
            : buildClaudePrompt(request);
    const mockText = process.env.NUNOPI_CLAUDE_MOCK_RESPONSE?.trim();

    if (mockText) {
      return isChat
        ? normalizeChatOutput(mockText, "claude-agent")
        : isExplainConcept
          ? normalizeExplainConceptOutput(mockText, "claude-agent", request)
          : isExplainToken
            ? normalizeExplainTokenOutput(mockText, "claude-agent", request)
            : isText
              ? normalizeTextOutput(mockText, "claude-agent", request)
              : normalizeClaudeOutput(mockText, request, availability, prompt);
    }

    try {
      const { text: rawText, usage } = await runClaudeCli(
        availability.commandPath!,
        prompt,
        options?.signal,
        options?.onProgress,
        isChat ? CHAT_SYSTEM_PROMPT : undefined,
        isChat,
      );
      return isChat
        ? normalizeChatOutput(rawText, "claude-agent")
        : isExplainConcept
          ? normalizeExplainConceptOutput(rawText, "claude-agent", request)
          : isExplainToken
            ? normalizeExplainTokenOutput(rawText, "claude-agent", request)
            : isText
              ? normalizeTextOutput(rawText, "claude-agent", request, usage)
              : normalizeClaudeOutput(rawText, request, availability, prompt, usage);
    } catch (err) {
      // 사용자 취소는 일반 실패가 아니므로 route로 전파한다(499 처리).
      if (options?.signal?.aborted) {
        throw err;
      }
      const message = err instanceof Error ? err.message : "claude -p failed";
      if (isChat) {
        return chatModeResponse("claude-agent", `Claude 응답 실패: ${message}`, [{ code: "PARSE_FAILED", message }]);
      }
      if (isExplainConcept) {
        return conceptModeResponse("claude-agent", [], [{ code: "PARSE_FAILED", message }]);
      }
      if (isExplainToken) {
        return tokenModeResponse("claude-agent", [], [{ code: "PARSE_FAILED", message }]);
      }
      if (isText) {
        return textModeResponse("claude-agent", `Claude CLI failed: ${message}`, [
          { code: "PARSE_FAILED", message },
        ]);
      }
      return {
        providerId: "claude-agent",
        language: request.detectedLanguage ?? "unknown",
        summary: `Claude CLI failed: ${message}`,
        lineExplanations: [],
        tokens: [],
        concepts: [],
        warnings: [{ code: "PARSE_FAILED", message }],
        createdAt: new Date().toISOString(),
      };
    }
  },
};

interface ClaudeExecResult {
  text: string;
  usage?: AgentUsage;
}

interface ClaudeStreamEvent {
  type?: string;
  subtype?: string;
  apiKeySource?: string;
  event?: { type?: string; delta?: { type?: string; text?: string } };
  result?: string;
  total_cost_usd?: number;
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function runClaudeCli(
  commandPath: string,
  prompt: string,
  signal?: AbortSignal,
  onProgress?: (line: string) => void,
  systemPrompt: string = "You are a code analysis assistant. Return JSON only.",
  fullProgress: boolean = false,
): Promise<ClaudeExecResult> {
  const MAX_STDERR = 2_048;
  const MAX_STDOUT = 8_388_608; // 8MB — stream-json + 세션 훅 노이즈까지 여유, 폭주 차단

  return new Promise((resolve, reject) => {
    // 시간 제한 없음 — 유저가 멈추기를 누르면 signal로 프로세스를 죽인다.
    if (signal?.aborted) {
      reject(new Error("분석이 취소되었습니다."));
      return;
    }

    const proc = spawn(
      commandPath,
      [
        "-p",
        // sonnet으로 실행(opus 대비 저렴/빠름).
        "--model", "sonnet",
        // 유저 글로벌 환경 로드 차단으로 입력 토큰을 줄인다(측정: fresh 입력 12432→3).
        // 이 플래그들은 이번 호출에만 적용 — 유저 settings/CLAUDE.md/훅/MCP 등록은 안 건드림.
        "--setting-sources", "",                          // 훅/CLAUDE.md/유저 settings 미로드
        "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', // MCP 서버 0
        "--system-prompt", systemPrompt, // 거대 기본 시스템 프롬프트 교체(코드 분석=JSON, 챗=튜터 프로즈)
        // stream-json + partial-messages로 토큰 델타·최종 result(텍스트+usage)를 받는다.
        "--output-format", "stream-json", "--verbose", "--include-partial-messages",
        // prompt는 positional, stdin은 닫음.
        prompt,
      ],
      { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
    );

    let stderr = "";
    let aborted = false;
    let consumed = 0;
    let stdoutBuf = "";
    let streamed = ""; // content_block_delta 누적(흐르는 진행 표시 + 폴백 텍스트)
    let finalText = "";
    let usage: AgentUsage | undefined;
    let apiKeySource: string | undefined; // init 이벤트의 인증 출처(none=구독)

    const onAbort = () => {
      aborted = true;
      proc.kill();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    proc.stdout?.on("data", (chunk: Buffer) => {
      consumed += chunk.length;
      if (consumed >= MAX_STDOUT) { proc.kill(); return; }
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let event: ClaudeStreamEvent;
        try {
          event = JSON.parse(trimmed) as ClaudeStreamEvent;
        } catch {
          continue;
        }
        if (event.type === "system" && event.subtype === "init") {
          apiKeySource = event.apiKeySource;
        } else if (
          event.type === "stream_event" &&
          event.event?.type === "content_block_delta" &&
          event.event.delta?.type === "text_delta" &&
          typeof event.event.delta.text === "string"
        ) {
          streamed += event.event.delta.text;
          // 챗은 전체 누적 텍스트(실시간 타이핑), 코드 모드는 진행 라벨용 끝 200자.
          onProgress?.(fullProgress ? streamed : streamed.slice(-200));
        } else if (event.type === "result") {
          if (typeof event.result === "string") finalText = event.result;
          if (event.usage) {
            // 구독(apiKeySource "none" 또는 불명)이면 비용은 실제 청구가 아니라
            // 환산값이므로 숨긴다. API 키 출처일 때만 비용을 표시한다.
            const billed = apiKeySource != null && apiKeySource !== "none";
            usage = {
              inputTokens: event.usage.input_tokens,
              outputTokens: event.usage.output_tokens,
              estimatedCostUsd: billed ? event.total_cost_usd : undefined,
            };
          }
        }
      }
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_STDERR) {
        stderr += chunk.toString().slice(0, MAX_STDERR - stderr.length);
      }
    });

    proc.on("error", (err) => { cleanup(); reject(err); });
    proc.on("close", (code) => {
      cleanup();
      if (aborted) {
        reject(new Error("분석이 취소되었습니다."));
        return;
      }
      const text = (finalText || streamed).trim();
      if (!text && code !== 0) {
        reject(new Error(`claude -p failed (exit code: ${code ?? "unknown"}). stderr: ${stderr.slice(0, 300)}`));
        return;
      }
      resolve({ text, usage });
    });
  });
}

function buildClaudePrompt(request: AgentAnalyzeRequest): string {
  return [
    "You are Nunopi's Claude analysis provider.",
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
    '      "conceptIds": string[]',
    "    }",
    "  ],",
    '  "concepts": [',
    '    { "conceptId": "string", "title": "string (Korean)" }',
    "  ],",
    '  "warnings": [{ "code": "PARTIAL_PARSE | UNKNOWN_LANGUAGE | PARSE_FAILED | TOO_LONG", "message": "string" }]',
    "}",
    "",
    "Do NOT include a per-line tokens array — the client derives token chips from each line's code. Output only line/code/explanation/conceptIds per entry. This keeps output small and fast.",
    ...codeChunkDirectives(request),
    "Only include a PARTIAL_PARSE warning if input was truncated; otherwise empty warnings.",
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

function buildPendingClaudeResponse(
  request: AgentAnalyzeRequest,
  availability: ClaudeAvailabilityResult,
  prompt: string,
): AgentAnalyzeResponse {
  return {
    providerId: "claude-agent",
    language: request.detectedLanguage ?? "unknown",
    summary: `Claude runtime detected at ${availability.commandPath}, and Nunopi prepared a prompt/response contract for live Claude analysis.`,
    lineExplanations: [],
    tokens: [],
    concepts: [],
    warnings: [
      {
        code: "PARTIAL_PARSE",
        message:
          "Claude runtime is available, but the live Claude Agent SDK or Claude Code bridge is not implemented yet.",
      },
    ],
    rawText: prompt,
    createdAt: new Date().toISOString(),
  };
}

function normalizeClaudeOutput(
  rawText: string,
  request: AgentAnalyzeRequest,
  availability: ClaudeAvailabilityResult,
  prompt: string,
  usage?: AgentUsage,
): AgentAnalyzeResponse {
  const parsed = parseClaudePayload(rawText);

  if (!parsed) {
    return {
      providerId: "claude-agent",
      language: request.detectedLanguage ?? "unknown",
      summary: `Claude runtime detected at ${availability.commandPath}, but the returned payload did not match Nunopi's expected JSON schema.`,
      lineExplanations: [],
      tokens: [],
      concepts: [],
      warnings: [
        {
          code: "PARSE_FAILED",
          message:
            "Claude output could not be normalized into AgentAnalyzeResponse. Check the prompt contract or raw payload shape.",
        },
      ],
      rawText: `${prompt}\n\n--- RAW RESPONSE ---\n${rawText}`,
      createdAt: new Date().toISOString(),
    };
  }

  return {
    providerId: "claude-agent",
    mode: "code",
    language: parsed.language ?? request.detectedLanguage ?? "unknown",
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : undefined,
    summary:
      parsed.summary ??
      `Claude runtime detected at ${availability.commandPath}, and a normalized Claude payload was returned.`,
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

function parseClaudePayload(rawText: string): ClaudeNormalizedPayload | null {
  const jsonCandidate = extractJsonCandidate(rawText);

  if (!jsonCandidate) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonCandidate);

    if (!isClaudeNormalizedPayload(parsed)) {
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

function isClaudeNormalizedPayload(value: unknown): value is ClaudeNormalizedPayload {
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

  // tokens/concepts는 배열인지만 느슨히 검사하고, 요소 검증은 normalize의
  // filter로 처리한다(토큰 하나가 어긋나도 요약·줄별 설명을 잃지 않게).
  if (value.tokens !== undefined && !Array.isArray(value.tokens)) {
    return false;
  }

  if (value.concepts !== undefined && !Array.isArray(value.concepts)) {
    return false;
  }

  // warnings도 배열인지만 느슨히 검사하고, 요소 검증은 normalize의 filter로 처리한다
  // (모델이 형식 안 맞는 warning 하나를 내도 요약·줄별 설명을 통째로 잃지 않게).
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

  // lines/count는 optional(LLM outline은 안 보냄). conceptId/title만 필수.
  return (
    typeof value.conceptId === "string" &&
    typeof value.title === "string" &&
    (value.lines === undefined ||
      (Array.isArray(value.lines) && value.lines.every((line) => typeof line === "number"))) &&
    (value.count === undefined || typeof value.count === "number")
  );
}


function isLineExplanation(value: unknown): value is AgentAnalyzeResponse["lineExplanations"][number] {
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

  return (
    isWarningCode(value.code) &&
    typeof value.message === "string"
  );
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

async function detectClaudeAvailability(request?: AgentAnalyzeRequest): Promise<ClaudeAvailabilityResult> {
  const explicitCommand =
    request?.providerSettings?.["claude-agent"]?.cliPath?.trim() ||
    process.env.NUNOPI_CLAUDE_COMMAND?.trim();

  if (explicitCommand) {
    const exists = await isExecutableFile(explicitCommand);

    if (exists) {
      return {
        available: true,
        commandPath: explicitCommand,
        message: `Claude runtime detected at ${explicitCommand}.`,
      };
    }

    return {
      available: false,
      message:
        "NUNOPI_CLAUDE_COMMAND is set, but the target file does not exist or is not executable.",
    };
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of pathEntries) {
    for (const command of CLAUDE_COMMAND_CANDIDATES) {
      const candidatePath = join(entry, command);

      if (await isExecutableFile(candidatePath)) {
        return {
          available: true,
          commandPath: candidatePath,
          message: `Claude runtime detected at ${candidatePath}.`,
        };
      }
    }
  }

  return {
    available: false,
    message:
      "Claude runtime was not found in PATH. Install Claude Code or set NUNOPI_CLAUDE_COMMAND to a valid executable path.",
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
