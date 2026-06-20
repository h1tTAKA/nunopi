// 병렬 청크(2단계) 코드 분석 오케스트레이터.
// 큰 코드는 줄별 설명 출력이 많아 단일 호출이 느리다(출력 토큰이 율속). 출력은 줄
// 수에 비례하므로, 줄별 설명만 N조각으로 나눠 동시에 받으면 wall-clock이 가장 큰
// 조각 시간으로 줄어든다(측정상 claude 동시 호출은 큰 출력도 거의 완전 병렬).
//
// 2단계로 품질을 지킨다:
//  1차(outline): 전체 코드로 title/summary/concepts(개념 id 확정)만. 출력 작아 빠름.
//  2차(chunks): 각 조각에 전체 코드(맥락) + 1차 concepts를 주고 줄 범위만 설명.
//               conceptId는 1차 id만 참조 → 개념 중복/연결 깨짐 없음. summary/title은 1차 것.
import type { AgentProvider, AgentAnalyzeCallOptions } from "./types";
import type { AgentAnalyzeRequest, AgentAnalyzeResponse, AgentUsage } from "./schema";

// 청크 트리거 임계 — 이 줄 수(빈 줄 제외) 초과 시에만 청크. 작은 코드는 단일 호출이 더 빠름.
const CHUNK_THRESHOLD_LINES = 40;
// 조각당 줄 수. 작을수록 조각이 빨라 wall-clock↓(병렬). 동시성 cap 안에서 잘게 나눈다.
// (실측: 84줄/30줄=3조각 → 청크 wall ~135s. 20줄로 줄여 더 잘게 = 더 빠름, 품질 무영향.)
const CHUNK_SIZE_LINES = 20;
// 동시 실행 상한(rate limit/폭주 차단).
const MAX_CONCURRENT_CHUNKS = 5;

const LLM_PROVIDER_IDS = new Set(["claude-agent", "codex-agent", "openai-compatible"]);

function nonEmptyLineCount(code: string): number {
  return code.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
}

// code 모드 + LLM provider + 충분히 큰 코드일 때만 청크. sub-call(outline/lineRange)은 제외.
export function shouldChunkCodeAnalysis(
  request: AgentAnalyzeRequest,
  provider: AgentProvider,
): boolean {
  if ((request.mode ?? "code") !== "code") return false;
  if (request.outlineOnly || request.lineRange) return false;
  if (!LLM_PROVIDER_IDS.has(provider.metadata.id)) return false;
  return nonEmptyLineCount(request.code) > CHUNK_THRESHOLD_LINES;
}

function sumUsage(responses: AgentAnalyzeResponse[]): AgentUsage | undefined {
  const usages = responses.map((r) => r.usage).filter((u): u is AgentUsage => u != null);
  if (usages.length === 0) return undefined;
  const sum = (pick: (u: AgentUsage) => number | undefined) =>
    usages.reduce((acc, u) => acc + (pick(u) ?? 0), 0);
  return {
    inputTokens: sum((u) => u.inputTokens),
    outputTokens: sum((u) => u.outputTokens),
    // 비용은 표시 정책상 보통 숨김(구독). 합산값만 둔다(있을 때).
    estimatedCostUsd: usages.some((u) => u.estimatedCostUsd != null)
      ? sum((u) => u.estimatedCostUsd)
      : undefined,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function analyzeCodeChunked(
  provider: AgentProvider,
  request: AgentAnalyzeRequest,
  options?: AgentAnalyzeCallOptions,
): Promise<AgentAnalyzeResponse> {
  // 1차 — 개념/요약/제목 확정.
  options?.onProgress?.("개요 분석 중…");
  const outline = await provider.analyze({ ...request, outlineOnly: true }, options);

  // 2차 — 줄 범위별 설명을 병렬로.
  const totalLines = request.code.split(/\r?\n/).length;
  const ranges: { start: number; end: number }[] = [];
  for (let s = 1; s <= totalLines; s += CHUNK_SIZE_LINES) {
    ranges.push({ start: s, end: Math.min(s + CHUNK_SIZE_LINES - 1, totalLines) });
  }
  const knownConcepts = (outline.concepts ?? [])
    .filter((c) => typeof c.conceptId === "string" && c.conceptId.length > 0)
    .map((c) => ({ conceptId: c.conceptId, title: c.title }));

  let done = 0;
  const partResponses = await mapWithConcurrency(
    ranges,
    MAX_CONCURRENT_CHUNKS,
    (range) =>
      provider
        .analyze({ ...request, lineRange: range, knownConcepts }, options)
        .then((r) => {
          done += 1;
          options?.onProgress?.(`줄별 설명 ${done}/${ranges.length} 조각 완료`);
          return r;
        })
        // 한 조각이 실패해도 나머지+outline은 살린다(전체 실패 금지).
        .catch(() => null),
  );

  const ok = partResponses.filter((r): r is AgentAnalyzeResponse => r != null);
  const lineExplanations = ok
    .flatMap((r) => r.lineExplanations ?? [])
    .sort((a, b) => a.line - b.line);

  return {
    ...outline,
    lineExplanations,
    usage: sumUsage([outline, ...ok]),
  };
}
