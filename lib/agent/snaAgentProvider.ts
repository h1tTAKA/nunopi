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
import { buildCardExplainPrompt } from "./cardExplainMode";
import {
  buildClaudePrompt,
  normalizeClaudeOutput,
  type ClaudeAvailabilityResult,
} from "./codePrompt";

// 분석/챗 런타임을 임베드 에이전트 런타임 서버(runOnce 스트림)로 처리하는 provider.
// claude-code / codex 두 런타임을 같은 로직으로 굴리되, runOnce 옵션만 런타임별로 분기한다.
// 프롬프트 빌더·정규화·partial 파싱·머지는 전부 기존 모듈 재사용.

type SnaRuntime = "claude-code" | "codex" | "opencode";

const CODE_SYSTEM_PROMPT = "You are a code analysis assistant. Return JSON only.";
// 카드 중복 묶기 — 경량. 프롬프트(요청 code)에 규칙·목록이 다 들어 있어 시스템은 출력형식만 강제.
// 산문·플래시카드 제안 없이 요청한 ```card-dedup 블록만 내게 해 토큰·지연을 최소화한다.
const DEDUP_SYSTEM_PROMPT =
  "You group duplicate flashcards. Output ONLY the requested ```card-dedup fenced block and nothing else — no prose, no explanation, no other code blocks.";

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
    onThinking?: (line: string) => void; // 추론(thinking) 누적 — 대기 구간 활동 표시용
    fullProgress?: boolean;
    effort?: boolean; // 분석은 low; 챗은 미강제
  },
): Promise<RunResult> {
  if (opts.signal?.aborted) throw new Error("분석이 취소되었습니다.");
  const client = await getSnaClient();
  const isClaude = opts.runtime === "claude-code";
  const isCodex = opts.runtime === "codex";

  // low 기준 reasoningLevel: claude=1, codex=2 (SNA 매핑표). opencode는 미강제(모델별 상이).
  const reasoningLevel = opts.effort && isClaude ? 1 : opts.effort && isCodex ? 2 : undefined;
  // runOnce는 model 미지정 시 SNA 글로벌 기본(claude-sonnet-4-6)을 주입한다 → codex/opencode엔
  // 그 모델이 가서 실패("not supported"/"Model not found"). 그래서 비-claude는 모델 명시 필수.
  // 환경마다 다르므로 env override(기본은 각 런타임의 합리적 기본).
  const codexModel = process.env.NUNOPI_CODEX_MODEL?.trim() || "gpt-5.5";
  const openCodeModel = process.env.NUNOPI_OPENCODE_MODEL?.trim() || "opencode/deepseek-v4-flash-free";
  const runtimeOpts = isClaude
    ? {
        model: "sonnet",
        // 토큰 최적화: 유저 설정/CLAUDE.md/훅 미로드 + 툴 정의 0(PoC 실측 cacheRead 16143→0).
        providerOptions: { settingSources: [""], strictMcpConfig: true } as Record<string, unknown>,
        extraArgs: ["--tools", ""],
      }
    : { model: isCodex ? codexModel : openCodeModel }; // codex/opencode: 모델만 명시(claude 플래그 미전달)

  let full = "";
  let think = ""; // 추론 누적
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
    } else if (type === "thinking_delta") {
      // 추론 조각 — 답변과 별개로 흘려 대기 구간에 "생각 중" 활동 표시.
      think += (ev.message as string | undefined) ?? "";
      opts.onThinking?.(think);
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
  if (request.mode === "chat" || request.mode === "dedup-cards") return chatModeResponse(providerId, message, warn);
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
      // 카드 디폴트 설명 — 챗처럼 자연어 마크다운을 fullProgress로 스트리밍(타이핑).
      const isCardExplain = request.mode === "explain-card";
      // 카드 중복 묶기 — 경량. 프롬프트는 요청 code 그대로, 저추론(low)·thinking/타이핑 스트림 없음.
      const isDedup = request.mode === "dedup-cards";
      const isChatLike = isChat || isCardExplain;

      // 런타임 서버 도달 가능성 확인.
      try {
        await getSnaClient();
      } catch (e) {
        const message = `에이전트 런타임 서버에 연결하지 못했다: ${e instanceof Error ? e.message : String(e)}`;
        return unavailableResponse(request, message, providerId);
      }

      const prompt = isDedup
        ? request.code // 클라가 규칙+카드목록을 이미 완성해 보냄(cardDedup.buildDedupContext).
        : isCardExplain
        ? buildCardExplainPrompt(request)
        : isChat
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
        return isChatLike || isDedup
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
        // 챗/카드설명은 답변을 누적 전체로 흘려 타이핑처럼 보이게 한다.
        let fullProgress = isChatLike;
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
          // 중복묶기는 블록만 내라는 경량 시스템프롬프트 + low(아래 effort).
          systemPrompt: isDedup ? DEDUP_SYSTEM_PROMPT : isChatLike ? chatSystemPrompt(request.locale) : CODE_SYSTEM_PROMPT,
          signal: options?.signal,
          onProgress: streamOnProgress,
          // 추론 표시는 챗류(덱 모달 등)에서만 — 분석/청크는 partial 파싱 경로라 미전달.
          onThinking: isChatLike ? options?.onThinking : undefined,
          fullProgress,
          effort: !isChatLike,
        });

        return isChatLike || isDedup
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
        if (isChatLike || isDedup) return chatModeResponse(providerId, `런타임 실패: ${message}`, warn);
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

export const snaOpenCodeProvider = createSnaProvider({
  id: "opencode-agent",
  runtime: "opencode",
  label: "OpenCode Agent (runtime)",
  mockEnv: "NUNOPI_OPENCODE_MOCK_RESPONSE",
});

// 하위 호환 별칭(기존 import 경로 유지).
export const snaAgentProvider = snaClaudeProvider;
