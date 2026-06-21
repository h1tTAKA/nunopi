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
  // 이어서 분석은 항상 청크 경로(이전 부분 결과가 청크에서 나옴).
  if (request.resumeFrom) return true;
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
  const prior = request.resumeFrom;
  // 1차 — 개념/요약/제목. 이어서 분석이면 이전 outline 재사용(개념 id 보존: 기존 줄설명의
  // conceptIds가 그 id를 참조하므로 재호출 금지). 처음이면 새로 호출.
  let outline: AgentAnalyzeResponse;
  if (prior) {
    outline = prior;
  } else {
    options?.onProgress?.("개요 분석 중…");
    outline = await provider.analyze({ ...request, outlineOnly: true }, options);
    // 요약/제목/개념 먼저 화면에 흘린다(줄설명은 아직 빈 배열). 모든 partial은
    // outline.createdAt을 공유 → 클라 reset effect(`[result?.createdAt]`) thrash 방지.
    options?.onPartial?.({ ...outline, lineExplanations: [] });
  }

  // 2차 — 줄 범위별 설명을 병렬로.
  const totalLines = request.code.split(/\r?\n/).length;
  const allRanges: { start: number; end: number }[] = [];
  for (let s = 1; s <= totalLines; s += CHUNK_SIZE_LINES) {
    allRanges.push({ start: s, end: Math.min(s + CHUNK_SIZE_LINES - 1, totalLines) });
  }
  // 이어서: 이미 줄설명이 있는 줄범위는 건너뛴다(청크 all-or-nothing이라 범위에 줄이
  // 하나라도 있으면 완료로 간주). 처음이면 전 범위.
  const coveredLines = new Set((prior?.lineExplanations ?? []).map((le) => le.line));
  const ranges =
    coveredLines.size === 0
      ? allRanges
      : allRanges.filter((r) => {
          for (let l = r.start; l <= r.end; l++) if (coveredLines.has(l)) return false;
          return true;
        });

  const knownConcepts = (outline.concepts ?? [])
    .filter((c) => typeof c.conceptId === "string" && c.conceptId.length > 0)
    .map((c) => ({ conceptId: c.conceptId, title: c.title }));

  // 줄번호 정렬 + 중복 line 제거(이어서 시 겹침 방어).
  const sortDedupe = (items: AgentAnalyzeResponse["lineExplanations"]) => {
    const seen = new Set<number>();
    return [...items]
      .sort((a, b) => a.line - b.line)
      .filter((le) => (seen.has(le.line) ? false : (seen.add(le.line), true)));
  };

  // 청크 진행률(완료/전체) — 막대바용. outline 끝났으니 0/total부터.
  options?.onChunkProgress?.(0, ranges.length);

  // 청크 sub-call엔 onProgress를 넘기지 않는다 — 각 청크의 raw stream delta(JSON 조각)가
  // 화면 진행줄을 오염시키지 않게. signal(취소)·onPartial(점진)·onChunkProgress는 유지.
  const chunkOptions: AgentAnalyzeCallOptions = {
    signal: options?.signal,
    onPartial: options?.onPartial,
    onChunkProgress: options?.onChunkProgress,
  };

  // 청크가 완료되는 족족 누적해 partial로 흘린다. 이어서면 기존 줄설명을 시드로 시작.
  const collected: AgentAnalyzeResponse["lineExplanations"] = [...(prior?.lineExplanations ?? [])];
  const okResponses: AgentAnalyzeResponse[] = [];
  let done = 0;
  await mapWithConcurrency(
    ranges,
    MAX_CONCURRENT_CHUNKS,
    (range) =>
      provider
        // sub-call이 또 resume 타지 않게 resumeFrom 제거.
        .analyze({ ...request, resumeFrom: undefined, lineRange: range, knownConcepts }, chunkOptions)
        .then((r) => {
          done += 1;
          options?.onChunkProgress?.(done, ranges.length);
          okResponses.push(r);
          collected.push(...(r.lineExplanations ?? []));
          options?.onPartial?.({ ...outline, lineExplanations: sortDedupe(collected), usage: sumUsage([outline, ...okResponses]) });
          return r;
        })
        // 한 조각이 실패해도 나머지+outline은 살린다(전체 실패 금지).
        .catch(() => null),
  );

  return {
    ...outline,
    lineExplanations: sortDedupe(collected),
    usage: sumUsage([outline, ...okResponses]),
  };
}
