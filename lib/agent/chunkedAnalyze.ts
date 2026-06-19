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
    createdAt: new Date().toISOString(),
  };
}

export interface ChunkedAnalyzeOptions {
  chunkLines: number;
  concurrency: number;
}

// 동시성 제한 풀로 작업들을 병렬 실행한다(순서 보존).
async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function runner(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
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
  let done = 0;
  options?.onProgress?.(`코드를 ${total}개 청크로 병렬 분석 시작…`);

  const results = await runPool(chunks, opts.concurrency, async (chunk) => {
    const res = await provider.analyze(
      { ...request, code: chunk.text },
      { signal: options?.signal },
    );
    done += 1;
    options?.onProgress?.(`청크 ${done}/${total} 완료`);
    return res;
  });

  const language = request.detectedLanguage ?? results[0]?.language ?? "unknown";
  return mergeChunkResults(results, request.providerId, language);
}
