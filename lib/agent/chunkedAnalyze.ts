// 대용량 코드 분석 속도 개선 — 코드를 청크로 나눠 병렬로 provider.analyze를 호출하고
// 결과를 하나로 병합한다. LLM 지연은 출력 토큰 양에 비례하므로, 작은 청크 N개를
// 병렬 처리하면 벽시계 시간이 대략 "가장 느린 한 청크" 수준으로 줄어든다.
import type { AgentAnalyzeRequest, AgentAnalyzeResponse, AgentUsage } from "./schema";
import type { AgentAnalyzeCallOptions, AgentProvider, AgentProviderKind } from "./types";
import type { AgentLineExplanation } from "./schema";
import type { CodeToken, ConceptOccurrence, TranslateWarning } from "@/lib/translator/types";

export interface CodeChunk {
  text: string;
  startLine: number; // 소스 기준 1-based 시작 줄
}

// 소스를 줄 단위로 chunkLines개씩 묶는다(줄 경계 보존).
export function splitCodeIntoChunks(code: string, chunkLines: number): CodeChunk[] {
  const lines = code.split(/\r?\n/);
  const chunks: CodeChunk[] = [];
  for (let i = 0; i < lines.length; i += chunkLines) {
    chunks.push({
      text: lines.slice(i, i + chunkLines).join("\n"),
      startLine: i + 1,
    });
  }
  return chunks;
}

function unionLines(a: number[], b: number[]): number[] {
  return Array.from(new Set([...a, ...b])).sort((x, y) => x - y);
}

// 청크 결과들을 단일 AgentAnalyzeResponse로 병합한다.
// - 토큰: token 텍스트를 키로 dedupe(글로벌 id = 텍스트). 청크-로컬 tokenId는 텍스트로 remap.
// - 개념: title을 키로 dedupe(글로벌 id = title).
// - lineExplanations: 청크 순서대로 concat + tokenIds/conceptIds remap + 청크별 line offset.
export function mergeChunkResults(
  results: AgentAnalyzeResponse[],
  providerId: AgentProviderKind,
  language: string,
  createdAt: string = new Date().toISOString(),
): AgentAnalyzeResponse {
  const tokens = new Map<string, CodeToken>(); // key = token 텍스트
  const concepts = new Map<string, ConceptOccurrence>(); // key = title
  const lineExplanations: AgentLineExplanation[] = [];
  const summaries: string[] = [];
  const warnings: TranslateWarning[] = [];
  const warningKeys = new Set<string>();
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  let hasUsage = false;
  let hasCost = false;

  results.forEach((r, k) => {
    // 청크 간 줄번호 충돌 방지용 offset(표시 줄번호는 클라 reanchor가 텍스트로 보정).
    const base = (k + 1) * 100_000;
    // 로컬 id → 글로벌 키(텍스트/타이틀) 매핑.
    const tokIdToText = new Map(r.tokens.map((t) => [t.id, t.token]));
    const conIdToTitle = new Map(r.concepts.map((c) => [c.conceptId, c.title]));

    for (const t of r.tokens) {
      const offsetLines = t.lines.map((n) => n + base);
      const existing = tokens.get(t.token);
      if (existing) {
        existing.lines = unionLines(existing.lines, offsetLines);
      } else {
        tokens.set(t.token, {
          ...t,
          id: t.token, // 글로벌 id = 토큰 텍스트
          conceptId: t.conceptId ? conIdToTitle.get(t.conceptId) : undefined,
          lines: offsetLines,
        });
      }
    }

    for (const c of r.concepts) {
      const offsetLines = c.lines.map((n) => n + base);
      const existing = concepts.get(c.title);
      if (existing) {
        existing.count += c.count;
        existing.lines = unionLines(existing.lines, offsetLines);
      } else {
        concepts.set(c.title, {
          ...c,
          conceptId: c.title, // 글로벌 id = title
          lines: offsetLines,
        });
      }
    }

    for (const le of r.lineExplanations) {
      const tokenIds = Array.from(
        new Set(le.tokenIds.map((id) => tokIdToText.get(id) ?? id)),
      );
      const conceptIds = Array.from(
        new Set(le.conceptIds.map((id) => conIdToTitle.get(id) ?? id)),
      );
      lineExplanations.push({ ...le, line: le.line + base, tokenIds, conceptIds });
    }

    if (r.summary?.trim()) summaries.push(r.summary.trim());
    for (const w of r.warnings) {
      const key = `${w.code}:${w.message}`;
      if (!warningKeys.has(key)) {
        warningKeys.add(key);
        warnings.push(w);
      }
    }
    if (r.usage) {
      hasUsage = true;
      inputTokens += r.usage.inputTokens ?? 0;
      outputTokens += r.usage.outputTokens ?? 0;
      if (r.usage.estimatedCostUsd != null) {
        hasCost = true;
        cost += r.usage.estimatedCostUsd;
      }
    }
  });

  const usage: AgentUsage | undefined = hasUsage
    ? { inputTokens, outputTokens, estimatedCostUsd: hasCost ? cost : undefined }
    : undefined;

  return {
    providerId,
    mode: "code",
    language,
    summary: summaries.join(" "),
    lineExplanations,
    tokens: Array.from(tokens.values()),
    concepts: Array.from(concepts.values()),
    warnings,
    usage,
    createdAt,
  };
}

export interface ChunkedAnalyzeOptions {
  chunkLines: number;
  concurrency: number;
  // 청크 하나가 완료될 때마다 "지금까지 완료된 청크들의 병합 결과"를 흘린다(부분 스트리밍).
  onPartial?: (response: AgentAnalyzeResponse) => void;
}

// 동시성 제한 풀로 작업들을 병렬 실행한다(순서 보존). onResult는 각 완료 직후 호출.
async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onResult?: (index: number, result: R) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function runner(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
      onResult?.(i, results[i]);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(runners);
  return results;
}

// 코드를 청크로 나눠 병렬 분석 후 병합한다.
export async function analyzeChunked(
  provider: AgentProvider,
  request: AgentAnalyzeRequest,
  options: AgentAnalyzeCallOptions | undefined,
  opts: ChunkedAnalyzeOptions,
): Promise<AgentAnalyzeResponse> {
  const chunks = splitCodeIntoChunks(request.code, opts.chunkLines);
  const total = chunks.length;
  // 부분 결과의 createdAt을 고정해 클라의 key 리마운트/깜빡임을 막는다.
  const createdAt = new Date().toISOString();
  let done = 0;
  // 완료된 청크를 인덱스 위치에 누적(소스 순서 유지) → 부분 병합에 사용.
  const acc: AgentAnalyzeResponse[] = [];
  const filled: boolean[] = new Array(chunks.length).fill(false);
  options?.onProgress?.(`코드를 ${total}개 청크로 병렬 분석 시작…`);

  const results = await runPool(
    chunks,
    opts.concurrency,
    async (chunk) => {
      const res = await provider.analyze(
        { ...request, code: chunk.text },
        { signal: options?.signal },
      );
      done += 1;
      options?.onProgress?.(`청크 ${done}/${total} 완료`);
      return res;
    },
    (index, res) => {
      acc[index] = res;
      filled[index] = true;
      if (!opts.onPartial) return;
      const completed = acc.filter((_, i) => filled[i]);
      const language = request.detectedLanguage ?? completed[0]?.language ?? "unknown";
      opts.onPartial(mergeChunkResults(completed, request.providerId, language, createdAt));
    },
  );

  const language = request.detectedLanguage ?? results[0]?.language ?? "unknown";
  return mergeChunkResults(results, request.providerId, language, createdAt);
}
