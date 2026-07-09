// SRS 상태 영속 — nunopi:srs-state (북마크 store와 분리).
// 키 = `${source}:${term}` (cardKey). 북마크 원본은 건드리지 않는다.

import type { SrsState } from "./types";

const SRS_KEY = "nunopi:srs-state";

export function loadSrsState(): Record<string, SrsState> {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SrsState>) : {};
  } catch (e) {
    // 손상 JSON — 조용히 {}로 덮으면 진도 유실. 경고 남기고 빈 상태로(저장은 채점 시에만).
    console.warn("[srs] state load failed:", String(e));
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

// 단일 카드의 SRS 상태 제거 — 카드 삭제 시 orphan 방지(재생성 시 옛 박스/스트릭 부활 방지).
export function removeCardState(key: string): void {
  const map = loadSrsState();
  if (key in map) {
    delete map[key];
    saveAll(map);
  }
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
