import "server-only";
import { getSnaClient } from "@/lib/sna/client";
import type { AgentAnalyzeRequest, AgentAnalyzeResponse, AgentUsage } from "./schema";
import type { AgentAnalyzeCallOptions, AgentProvider, AgentProviderKind } from "./types";
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
} from "./codePrompt";

// 분석/챗 런타임을 임베드 에이전트 런타임 서버(runOnce 스트림)로 처리하는 provider.
// claude-code / codex 두 런타임을 같은 로직으로 굴리되, runOnce 옵션만 런타임별로 분기한다.
// 프롬프트 빌더·정규화·partial 파싱·머지는 전부 기존 모듈 재사용.

type SnaRuntime = "claude-code" | "codex";

const CODE_SYSTEM_PROMPT = "You are a code analysis assistant. Return JSON only.";

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
  const total = (inputTokens ?? 0) + (outputTokens ?? 0);
  if (inputTokens === undefined && outputTokens === undefined) {
    return undefined;
  }
  // 구독 런타임이라 SNA가 보고하는 costUsd는 실제 청구가 아닌 추정치 → 비용 미표시 원칙상 매핑 안 함.
  return {
    inputTokens,
    outputTokens,
    totalTokens: total > 0 ? total : undefined,
  };
}

// runClaudeCli/codex exec 등가물 — runOnce 스트림을 누적해 { text, usage } 반환.
// 런타임별 분기: claude는 토큰 최적화 플래그(툴 정의 0 + 유저 설정 미로드)를 붙이고,
// codex는 그 플래그가 claude 전용이라 안 붙인다(어댑터가 알아서).
async function runViaSna(
  prompt: string,
  opts: {
    runtime: SnaRuntime;
    systemPrompt?: string;
    signal?: AbortSignal;
    onProgress?: (line: string) => void;
    fullProgress?: boolean;
    effort?: boolean; // 분석은 low; 챗은 미강제
  },
): Promise<RunResult> {
  if (opts.signal?.aborted) throw new Error("분석이 취소되었습니다.");
  const client = await getSnaClient();
  const isCodex = opts.runtime === "codex";

  // low 기준 reasoningLevel: claude=1, codex=2 (SNA 매핑표상 둘 다 "low" 근접).
  const reasoningLevel = opts.effort ? (isCodex ? 2 : 1) : undefined;
  // runOnce는 model 미지정 시 SNA 글로벌 기본(claude-sonnet-4-6)을 주입한다 → codex엔
  // claude 모델이 가서 400("claude model not supported"). 그래서 codex는 모델을 명시해야 한다.
  // 환경마다 다르므로 env override(기본은 codex의 현행 기본 모델).
  const codexModel = process.env.NUNOPI_CODEX_MODEL?.trim() || "gpt-5.5";
  const runtimeOpts = isCodex
    ? { model: codexModel }
    : {
        model: "sonnet",
        // 토큰 최적화: 유저 설정/CLAUDE.md/훅 미로드 + 툴 정의 0(PoC 실측 cacheRead 16143→0).
        providerOptions: { settingSources: [""], strictMcpConfig: true } as Record<string, unknown>,
        extraArgs: ["--tools", ""],
      };

  let full = "";
  let streamed = false;
  let usage: AgentUsage | undefined;

  for await (const ev of client.agent.runOnceStream({
    message: prompt,
    provider: opts.runtime,
    systemPrompt: opts.systemPrompt ?? CODE_SYSTEM_PROMPT,
    reasoningLevel,
    timeout: 600_000, // 큰/청크 분석 대비 충분히 크게.
    ...runtimeOpts,
  })) {
    if (opts.signal?.aborted) throw new Error("분석이 취소되었습니다.");
    const type = ev.type as string | undefined;
    if (type === "assistant_delta") {
      streamed = true;
      full += (ev.delta as string | undefined) ?? "";
      // 비-full(코드/explain 진행 라벨)은 누적 끝 200자만 — runClaudeCli와 동일(델타 조각 X).
      opts.onProgress?.(opts.fullProgress ? full : full.slice(-200));
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

// SNA 도달 불가 시 모드별 에러 응답.
function unavailableResponse(
  request: AgentAnalyzeRequest,
  message: string,
  providerId: AgentProviderKind,
): AgentAnalyzeResponse {
  const warn = [{ code: "PARTIAL_PARSE" as const, message }];
  if (request.mode === "chat") return chatModeResponse(providerId, message, warn);
  if (request.mode === "explain-concept") return conceptModeResponse(providerId, [], warn);
  if (request.mode === "explain-token") return tokenModeResponse(providerId, [], warn);
  if (request.mode === "text") return textModeResponse(providerId, message, warn);
  return {
    providerId,
    language: request.detectedLanguage ?? "unknown",
    summary: message,
    lineExplanations: [],
    tokens: [],
    concepts: [],
    warnings: warn,
    createdAt: new Date().toISOString(),
  };
}

interface SnaProviderConfig {
  id: AgentProviderKind; // "claude-agent" | "codex-agent"
  runtime: SnaRuntime;
  label: string;
  mockEnv: string; // 테스트용 mock 응답 env 이름
}

// 런타임별 provider 인스턴스를 만든다(claude/codex 공통 로직 1벌).
function createSnaProvider(cfg: SnaProviderConfig): AgentProvider {
  const providerId = cfg.id;
  return {
    metadata: {
      id: cfg.id,
      label: cfg.label,
      description: "Code/text analysis & chat via the embedded agent runtime server (runOnce).",
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

      // 런타임 서버 도달 가능성 확인.
      try {
        await getSnaClient();
      } catch (e) {
        const message = `에이전트 런타임 서버에 연결하지 못했다: ${e instanceof Error ? e.message : String(e)}`;
        return unavailableResponse(request, message, providerId);
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

      const mockText = process.env[cfg.mockEnv]?.trim();
      // 정규화에 필요한 stub availability(메시지 cosmetic 용도로만 사용됨).
      const stubAvailability: ClaudeAvailabilityResult = {
        available: true,
        commandPath: "embedded-runtime",
        message: "embedded runtime",
      };

      if (mockText) {
        return isChat
          ? normalizeChatOutput(mockText, providerId)
          : isExplainConcept
            ? normalizeExplainConceptOutput(mockText, providerId, request)
            : isExplainToken
              ? normalizeExplainTokenOutput(mockText, providerId, request)
              : isText
                ? normalizeTextOutput(mockText, providerId, request)
                : normalizeClaudeOutput(mockText, request, stubAvailability, prompt, undefined, providerId);
      }

      try {
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
            const fresh = parseTextStreamPartial(full, providerId, startedAt);
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
          runtime: cfg.runtime,
          // 챗은 언어별 튜터 시스템프롬프트 + thinking 살림(effort 미강제). 분석은 JSON 지시 + low.
          systemPrompt: isChat ? chatSystemPrompt(request.locale) : CODE_SYSTEM_PROMPT,
          signal: options?.signal,
          onProgress: streamOnProgress,
          fullProgress,
          effort: !isChat,
        });

        return isChat
          ? normalizeChatOutput(rawText, providerId)
          : isExplainConcept
            ? normalizeExplainConceptOutput(rawText, providerId, request)
            : isExplainToken
              ? normalizeExplainTokenOutput(rawText, providerId, request)
              : isText
                ? (() => {
                    const fresh = normalizeTextOutput(rawText, providerId, request, usage);
                    return prior ? mergeTextResults(prior, fresh) : fresh;
                  })()
                : normalizeClaudeOutput(rawText, request, stubAvailability, prompt, usage, providerId);
      } catch (err) {
        if (options?.signal?.aborted) throw err; // 취소는 route로 전파(499)
        const message = err instanceof Error ? err.message : "runtime run failed";
        const warn = [{ code: "PARSE_FAILED" as const, message }];
        if (isChat) return chatModeResponse(providerId, `런타임 실패: ${message}`, warn);
        if (isExplainConcept) return conceptModeResponse(providerId, [], warn);
        if (isExplainToken) return tokenModeResponse(providerId, [], warn);
        if (isText) return textModeResponse(providerId, `런타임 실패: ${message}`, warn);
        return {
          providerId,
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
}

export const snaClaudeProvider = createSnaProvider({
  id: "claude-agent",
  runtime: "claude-code",
  label: "Claude Agent (runtime)",
  mockEnv: "NUNOPI_CLAUDE_MOCK_RESPONSE",
});

export const snaCodexProvider = createSnaProvider({
  id: "codex-agent",
  runtime: "codex",
  label: "Codex Agent (runtime)",
  mockEnv: "NUNOPI_CODEX_MOCK_RESPONSE",
});

// 하위 호환 별칭(기존 import 경로 유지).
export const snaAgentProvider = snaClaudeProvider;
