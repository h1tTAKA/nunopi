// 글(text) 분석 청크 스트리밍 오케스트레이터.
// 단일 호출은 용어+개념+설명을 한 번에 생성해 느리다. 대신:
//  1차 outline: 용어/개념 "골격"(설명 없이) 빠르게 → 이름 먼저 표시.
//  2차 용어 설명 배치 병렬 → 도착 순 채움.
//  3차 개념 설명 배치 병렬 → 채움(용어 다음).
// partial/chunk-progress 이벤트는 코드 모드와 동일 인프라 재사용(#110/#112).
import type { AgentProvider, AgentAnalyzeCallOptions } from "./types";
import type { AgentAnalyzeRequest, AgentAnalyzeResponse } from "./schema";
import type { ItConcept, ItTerm } from "@/lib/translator/types";

// 글자수 임계 — 이 길이 초과 글만 청크(작은 글은 단일이 더 빠름).
const TEXT_CHUNK_THRESHOLD_CHARS = 400;
const TERM_BATCH = 6; // 용어 설명 배치 크기
const CONCEPT_BATCH = 6; // 개념 설명 배치 크기
const MAX_CONCURRENT = 5;

const LLM_PROVIDER_IDS = new Set(["claude-agent", "codex-agent", "openai-compatible"]);

export function shouldChunkTextAnalysis(
  request: AgentAnalyzeRequest,
  provider: AgentProvider,
): boolean {
  if (request.mode !== "text") return false;
  if (request.textStage) return false; // sub-call 제외
  if (!LLM_PROVIDER_IDS.has(provider.metadata.id)) return false;
  return request.code.trim().length > TEXT_CHUNK_THRESHOLD_CHARS;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function analyzeTextChunked(
  provider: AgentProvider,
  request: AgentAnalyzeRequest,
  options?: AgentAnalyzeCallOptions,
): Promise<AgentAnalyzeResponse> {
  // 1차 — 용어/개념 골격(설명 빈). raw delta 누출 방지로 onProgress는 outline에만(짧음).
  options?.onProgress?.("용어·개념 추출 중…");
  const outline = await provider.analyze({ ...request, textStage: "outline" }, options);

  // 골격을 id/conceptId로 들고, 설명 배치가 채울 때마다 갱신.
  const termsById = new Map<string, ItTerm>((outline.terms ?? []).map((t) => [t.id, t]));
  const conceptsById = new Map<string, ItConcept>(
    (outline.itConcepts ?? []).map((c) => [c.conceptId, c]),
  );

  const termBatches = chunk([...termsById.values()], TERM_BATCH);
  const conceptBatches = chunk([...conceptsById.values()], CONCEPT_BATCH);
  const totalBatches = termBatches.length + conceptBatches.length;
  let done = 0;

  // sub-call엔 onProgress 제거(raw delta 누출 차단), signal/onPartial/onChunkProgress만.
  const subOptions: AgentAnalyzeCallOptions = {
    signal: options?.signal,
    onPartial: options?.onPartial,
    onChunkProgress: options?.onChunkProgress,
  };

  const snapshot = (): AgentAnalyzeResponse => ({
    ...outline,
    terms: [...termsById.values()],
    itConcepts: [...conceptsById.values()],
    warnings: [],
  });

  // 골격 먼저 표시(설명은 빈 → UI "분석 중").
  options?.onChunkProgress?.(0, totalBatches);
  options?.onPartial?.(snapshot());

  // 2차 — 용어 설명 배치 병렬.
  await mapWithConcurrency(termBatches, MAX_CONCURRENT, (batch) =>
    provider
      .analyze(
        {
          ...request,
          textStage: "terms",
          targetTerms: batch.map((t) => ({
            id: t.id,
            term: t.term,
            reading: t.reading,
            conceptIds: t.conceptIds ?? [],
          })),
        },
        subOptions,
      )
      .then((r) => {
        for (const t of r.terms ?? []) {
          const base = termsById.get(t.id);
          if (base && t.explanation) termsById.set(t.id, { ...base, explanation: t.explanation });
        }
        done += 1;
        options?.onChunkProgress?.(done, totalBatches);
        options?.onPartial?.(snapshot());
      })
      .catch(() => {}),
  );

  // 3차 — 개념 설명 배치 병렬(용어 다음).
  await mapWithConcurrency(conceptBatches, MAX_CONCURRENT, (batch) =>
    provider
      .analyze(
        {
          ...request,
          textStage: "concepts",
          targetConcepts: batch.map((c) => ({ conceptId: c.conceptId, title: c.title })),
        },
        subOptions,
      )
      .then((r) => {
        for (const c of r.itConcepts ?? []) {
          const base = conceptsById.get(c.conceptId);
          if (base && c.explanation) conceptsById.set(c.conceptId, { ...base, explanation: c.explanation });
        }
        done += 1;
        options?.onChunkProgress?.(done, totalBatches);
        options?.onPartial?.(snapshot());
      })
      .catch(() => {}),
  );

  return snapshot();
}
