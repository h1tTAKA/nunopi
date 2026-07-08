// 암기 복습 세션 진행 상태 영속 — 덱×모드별로 중단 후 이어하기.
// 카드는 키만 저장하고 재개 시 collectCards로 복원(삭제된 북마크는 스킵).
import type { Deck, SrsSource } from "./srs/types";

const KEY = "nunopi:mem-session";

export interface SavedSession {
  sources: SrsSource[];
  roundKeys: string[]; // 현재 라운드 카드 키(순서 유지)
  idx: number; // 현재 위치
  roundNo: number;
  stats: { again: number; hard: number; good: number };
  againKeys: string[]; // 이번 라운드 "다시" 모음
  savedAt: string;
}

type Store = Record<string, SavedSession>; // `${deck}:${mode}` -> 세션

function sessionKey(deck: Deck, mode: "due" | "all"): string {
  return `${deck}:${mode}`;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

export function loadMemSession(deck: Deck, mode: "due" | "all"): SavedSession | null {
  return load()[sessionKey(deck, mode)] ?? null;
}

export function hasMemSession(deck: Deck, mode: "due" | "all"): boolean {
  const s = load()[sessionKey(deck, mode)];
  return !!s && s.roundKeys.length > 0;
}

export function saveMemSession(deck: Deck, mode: "due" | "all", session: SavedSession): void {
  try {
    const store = load();
    store[sessionKey(deck, mode)] = session;
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function clearMemSession(deck: Deck, mode: "due" | "all"): void {
  try {
    const store = load();
    delete store[sessionKey(deck, mode)];
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}
