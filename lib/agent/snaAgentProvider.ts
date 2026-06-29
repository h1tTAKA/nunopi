import "server-only";
import { getSnaClient } from "@/lib/sna/client";
import type { AgentAnalyzeRequest, AgentAnalyzeResponse, AgentUsage } from "./schema";
import type { AgentAnalyzeCallOptions, AgentProvider } from "./types";
import {
  buildTextPrompt,
  mergeTextResults,
  normalizeTextOutput,
  parseTextStreamPartial,
  textModeResponse,
} from "./textMode";
import { buildExplainTokenPrompt, normalizeExplainTokenOutput, tokenModeResponse } from "./tokenMode";
import { buildExplainConceptPrompt, normalizeExplainConceptOutput, conceptModeResponse } from "./conceptMode";
import { buildChatPrompt, chatSystemPrompt, normalizeChatOutput, chatModeResponse } from "./chatMode";
import {
  buildClaudePrompt,
  normalizeClaudeOutput,
  type ClaudeAvailabilityResult,
} from "./claudeAgentProvider";

// 분석 런타임을 임베드 에이전트 런타임 서버(runOnce 스트림)로 처리하는 provider.
// claudeAgentProvider.analyze()의 모드 디스패치를 그대로 미러링하되 CLI spawn만 교체한다.
// 프롬프트 빌더·정규화·partial 파싱·머지는 전부 기존 모듈을 재사용한다.
// chat 모드는 이번 범위 밖 → 기존 claudeAgentProvider로 위임(Issue ③에서 교체).

const CODE_SYSTEM_PROMPT = "You are a code analysis assistant. Return JSON only.";

// runtime 결과 — runClaudeCli와 동일한 형태({ text, usage }).
interface RunResult {
  text: string;
  usage?: AgentUsage;
}

function toNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function mapUsage(data: unknown): AgentUsage | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const d = data as Record<string, unknown>;
  const inputTokens = toNum(d.inputTokens);
  const outputTokens = toNum(d.outputTokens);
  const estimatedCostUsd = toNum(d.costUsd);
  const total = (inputTokens ?? 0) + (outputTokens ?? 0);
  if (inputTokens === undefined && outputTokens === undefined && estimatedCostUsd === undefined) {
    return undefined;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens: total > 0 ? total : undefined,
    estimatedCostUsd,
  };
}

// runClaudeCli 등가물 — runOnce 스트림을 누적해 { text, usage } 반환.
// 토큰 최적화(툴 정의 0 + 유저 설정 미로드)와 effort(low)를 그대로 재현한다.
async function runViaSna(
  prompt: string,
  opts: {
    systemPrompt?: string;
    signal?: AbortSignal;
    onProgress?: (line: string) => void;
    fullProgress?: boolean;
    effort?: boolean; // 분석은 low(=reasoningLevel 1); chat은 위임이라 해당 없음
  },
): Promise<RunResult> {
  if (opts.signal?.aborted) throw new Error("분석이 취소되었습니다.");
  const client = await getSnaClient();

  let full = "";
  let streamed = false;
  let usage: AgentUsage | undefined;

  for await (const ev of client.agent.runOnceStream({
    message: prompt,
    model: "sonnet",
    systemPrompt: opts.systemPrompt ?? CODE_SYSTEM_PROMPT,
    reasoningLevel: opts.effort ? 1 : undefined, // claude --effort low
    // 토큰 최적화: 유저 설정/CLAUDE.md/훅 미로드 + 툴 정의 0(PoC 실측 cacheRead 16143→0).
    providerOptions: { settingSources: [""], strictMcpConfig: true },
    extraArgs: ["--tools", ""],
    timeout: 600_000, // runClaudeCli는 무제한 — 큰/청크 분석 대비 충분히 크게.
  })) {
    if (opts.signal?.aborted) throw new Error("분석이 취소되었습니다.");
    const type = ev.type as string | undefined;
    if (type === "assistant_delta") {
      streamed = true;
      full += (ev.delta as string | undefined) ?? "";
      opts.onProgress?.(opts.fullProgress ? full : ((ev.delta as string | undefined) ?? ""));
    } else if (type === "assistant" && !streamed) {
      full = (ev.message as string | undefined) ?? "";
      opts.onProgress?.(full);
    } else if (type === "complete") {
      usage = mapUsage(ev.data);
    } else if (type === "error") {
      throw new Error(String(ev.message ?? "runtime error"));
    }
  }

  return { text: full, usage };
}

// SNA가 도달 불가일 때(서버 미기동 등) 모드별 에러 응답 — 기존 availability 실패 분기와 동일 형태.
function unavailableResponse(request: AgentAnalyzeRequest, message: string): AgentAnalyzeResponse {
  const warn = [{ code: "PARTIAL_PARSE" as const, message }];
  if (request.mode === "chat") return chatModeResponse("claude-agent", message, warn);
  if (request.mode === "explain-concept") return conceptModeResponse("claude-agent", [], warn);
  if (request.mode === "explain-token") return tokenModeResponse("claude-agent", [], warn);
  if (request.mode === "text") return textModeResponse("claude-agent", message, warn);
  return {
    providerId: "claude-agent",
    language: request.detectedLanguage ?? "unknown",
    summary: message,
    lineExplanations: [],
    tokens: [],
    concepts: [],
    warnings: warn,
    createdAt: new Date().toISOString(),
  };
}

export const snaAgentProvider: AgentProvider = {
  metadata: {
    id: "claude-agent",
    label: "Claude Agent (runtime)",
    description: "Code/text analysis via the embedded agent runtime server (runOnce).",
    executionLocation: "local-server",
    dataHandling: "remote-provider",
    capabilities: {
      streaming: true,
      cancellation: true,
      fileSystemAccess: false,
      shellAccess: false,
      requiresApiKey: false,
      requiresLocalProcess: true,
    },
  },

  async analyze(
    request: AgentAnalyzeRequest,
    options?: AgentAnalyzeCallOptions,
  ): Promise<AgentAnalyzeResponse> {
    const isChat = request.mode === "chat";
    const isText = request.mode === "text";
    const isExplainToken = request.mode === "explain-token";
    const isExplainConcept = request.mode === "explain-concept";

    // 런타임 서버 도달 가능성 확인(기존 detectClaudeAvailability 대체).
    try {
      await getSnaClient();
    } catch (e) {
      const message = `에이전트 런타임 서버에 연결하지 못했다: ${e instanceof Error ? e.message : String(e)}`;
      return unavailableResponse(request, message);
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
    // 정규화에 필요한 stub availability(메시지 cosmetic 용도로만 사용됨).
    const stubAvailability: ClaudeAvailabilityResult = {
      available: true,
      commandPath: "embedded-runtime",
      message: "embedded runtime",
    };

    if (mockText) {
      return isChat
        ? normalizeChatOutput(mockText, "claude-agent")
        : isExplainConcept
          ? normalizeExplainConceptOutput(mockText, "claude-agent", request)
          : isExplainToken
            ? normalizeExplainTokenOutput(mockText, "claude-agent", request)
            : isText
              ? normalizeTextOutput(mockText, "claude-agent", request)
              : normalizeClaudeOutput(mockText, request, stubAvailability, prompt);
    }

    try {
      // 글 모드: 누적 텍스트를 점진 파싱해 용어/개념을 onPartial로 흘린다(기존 로직 동일).
      let streamOnProgress = options?.onProgress;
      // 챗은 답변 토큰을 누적 전체로 흘려 page의 chatStreaming이 타이핑처럼 보이게 한다.
      let fullProgress = isChat;
      const prior = isText ? request.resumeFrom : undefined;
      if (isText && options?.onPartial) {
        const onPartial = options.onPartial;
        const startedAt = new Date().toISOString();
        let lastT = -1;
        let lastC = -1;
        let lastS = -1;
        streamOnProgress = (full: string) => {
          if (!full.includes("}")) return;
          const fresh = parseTextStreamPartial(full, "claude-agent", startedAt);
          if (!fresh) return;
          const partial = prior ? mergeTextResults(prior, fresh) : fresh;
          const t = partial.terms?.length ?? 0;
          const c = partial.itConcepts?.length ?? 0;
          const s = partial.summary.length;
          if (t === lastT && c === lastC && s === lastS) return;
          lastT = t;
          lastC = c;
          lastS = s;
          onPartial(partial);
        };
        fullProgress = true;
      }

      const { text: rawText, usage } = await runViaSna(prompt, {
        // 챗은 언어별 튜터 시스템프롬프트 + thinking 살림(effort 미강제). 분석은 JSON 지시 + low.
        systemPrompt: isChat ? chatSystemPrompt(request.locale) : CODE_SYSTEM_PROMPT,
        signal: options?.signal,
        onProgress: streamOnProgress,
        fullProgress,
        effort: !isChat,
      });

      return isChat
        ? normalizeChatOutput(rawText, "claude-agent")
        : isExplainConcept
        ? normalizeExplainConceptOutput(rawText, "claude-agent", request)
        : isExplainToken
          ? normalizeExplainTokenOutput(rawText, "claude-agent", request)
          : isText
            ? (() => {
                const fresh = normalizeTextOutput(rawText, "claude-agent", request, usage);
                return prior ? mergeTextResults(prior, fresh) : fresh;
              })()
            : normalizeClaudeOutput(rawText, request, stubAvailability, prompt, usage);
    } catch (err) {
      if (options?.signal?.aborted) throw err; // 취소는 route로 전파(499)
      const message = err instanceof Error ? err.message : "runtime run failed";
      const warn = [{ code: "PARSE_FAILED" as const, message }];
      if (isChat) return chatModeResponse("claude-agent", `런타임 실패: ${message}`, warn);
      if (isExplainConcept) return conceptModeResponse("claude-agent", [], warn);
      if (isExplainToken) return tokenModeResponse("claude-agent", [], warn);
      if (isText) return textModeResponse("claude-agent", `런타임 실패: ${message}`, warn);
      return {
        providerId: "claude-agent",
        language: request.detectedLanguage ?? "unknown",
        summary: `런타임 실패: ${message}`,
        lineExplanations: [],
        tokens: [],
        concepts: [],
        warnings: warn,
        createdAt: new Date().toISOString(),
      };
    }
  },
};
