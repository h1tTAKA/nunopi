// 암기 카드 "디폴트 설명"(explain-card) 스트림 소비 + localStorage 캐시.
// 한 번 생성한 카드 설명은 cardKey로 고정 저장 → 재방문 시 즉시 표시. 리셋은 삭제.

import type { AgentProviderKind } from "@/lib/agent";

const CACHE_KEY = "nunopi:card-explain";

type CacheMap = Record<string, string>; // cardKey -> markdown

function loadCache(): CacheMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheMap) : {};
  } catch {
    return {};
  }
}

export function loadCardExplain(cardKey: string): string | null {
  return loadCache()[cardKey] ?? null;
}

export function saveCardExplain(cardKey: string, markdown: string): void {
  try {
    const map = loadCache();
    map[cardKey] = markdown;
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function clearCardExplain(cardKey: string): void {
  try {
    const map = loadCache();
    delete map[cardKey];
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// analyze(explain-card) NDJSON 스트림을 읽어 누적 텍스트를 onChunk로 흘린다(타이핑).
// 반환: 최종 마크다운 전체(호출부가 캐시 저장). 취소 시 throw.
export async function streamCardExplain(
  params: {
    term: string;
    kind: "token" | "concept" | "term";
    providerId: AgentProviderKind;
    locale: "ko" | "ja" | "en";
  },
  onChunk: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/agent/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: "",
      locale: params.locale,
      providerId: params.providerId,
      mode: "explain-card",
      targetTerm: params.term,
      targetKind: params.kind,
    }),
    signal,
  });
  if (!res.body) throw new Error("no stream body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: { type: string; line?: string; message?: string };
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      // chat류 스트림: progress.line = 누적 전체 텍스트.
      if (event.type === "progress" && typeof event.line === "string") {
        full = event.line;
        onChunk(full);
      } else if (event.type === "error") {
        throw new Error(event.message ?? "explain failed");
      }
    }
  }
  return full;
}
