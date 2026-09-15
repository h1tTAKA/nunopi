// 암기 복습 세션 진행 상태 영속 — 덱×모드별로 중단 후 이어하기.
// 카드는 키만 저장하고 재개 시 collectCards로 복원(삭제된 북마크는 스킵).
import type { SrsSource } from "./srs/types";

const KEY = "nunopi:mem-session";

export interface SavedSession {
  sources: SrsSource[];
  roundKeys: string[]; // 세션 카드 키(순서 유지) — 한 바퀴만 돈다(자동 재복습 라운드 없음)
  idx: number; // 현재 위치
  stats: { again: number; hard: number; good: number };
  // 세션 전체에서 최악 등급이 '다시'/'애매'인 카드 키(재복습 후보). 이어하기 시 복원해 완료 화면 재복습 목록에 반영.
  reviewedAgain?: string[];
  reviewedHard?: string[];
  savedAt: string;
}

type Store = Record<string, SavedSession>; // `${deck}:${mode}` -> 세션

function sessionKey(deckKey: string, mode: "due" | "all"): string {
  return `${deckKey}:${mode}`;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

export function loadMemSession(deckKey: string, mode: "due" | "all"): SavedSession | null {
  return load()[sessionKey(deckKey, mode)] ?? null;
}

export function hasMemSession(deckKey: string, mode: "due" | "all"): boolean {
  const s = load()[sessionKey(deckKey, mode)];
  return !!s && s.roundKeys.length > 0;
}

// 덱의 진행 중 세션 찾기(모드 무관) — 이어서하기는 현재 옵션과 독립하게 저장된 세션 그대로 복원한다.
// due/all 둘 다 있으면 더 최근(savedAt) 것.
export function findMemSession(deckKey: string): { mode: "due" | "all"; session: SavedSession } | null {
  const store = load();
  const found = (["due", "all"] as const)
    .map((mode) => ({ mode, session: store[sessionKey(deckKey, mode)] }))
    .filter((x): x is { mode: "due" | "all"; session: SavedSession } => !!x.session && x.session.roundKeys.length > 0);
  if (found.length === 0) return null;
  found.sort((a, b) => b.session.savedAt.localeCompare(a.session.savedAt));
  return found[0];
}

export function saveMemSession(deckKey: string, mode: "due" | "all", session: SavedSession): void {
  try {
    const store = load();
    store[sessionKey(deckKey, mode)] = session;
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function clearMemSession(deckKey: string, mode: "due" | "all"): void {
  try {
    const store = load();
    delete store[sessionKey(deckKey, mode)];
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}
