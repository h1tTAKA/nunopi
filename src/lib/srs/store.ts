// SRS 상태 영속 — nunopi:srs-state (북마크 store와 분리).
// 키 = `${source}:${term}` (cardKey). 북마크 원본은 건드리지 않는다.

import type { SrsState } from "./types";

const SRS_KEY = "nunopi:srs-state";

export function loadSrsState(): Record<string, SrsState> {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SrsState>) : {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, SrsState>): void {
  try {
    localStorage.setItem(SRS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// 카드 한 장의 상태를 갱신 저장.
export function updateCardState(key: string, state: SrsState): void {
  const map = loadSrsState();
  map[key] = state;
  saveAll(map);
}

// 북마크에서 사라진 orphan 키 정리(선택적 gc — 현재 유효한 키 집합을 받아 그 외 제거).
export function pruneSrsState(validKeys: Set<string>): void {
  const map = loadSrsState();
  let changed = false;
  for (const k of Object.keys(map)) {
    if (!validKeys.has(k)) {
      delete map[k];
      changed = true;
    }
  }
  if (changed) saveAll(map);
}
