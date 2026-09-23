"use client";

// Mustard 통합 설정 스토어(#924·#925) — 신규 스칼라 옵션(서브2~5: 터미널·에이전트·알림·확인)용 토대.
// 기존 옵션(theme/terminal-theme/locale/provider-settings/runtime-paths)은 각자 기존 통로를 그대로 두고,
// 여기선 "그 외 다양한 스칼라 설정"을 단일 JSON(localStorage "mustard:settings")으로 모은다.
// 타입은 서브별로 아래 MustardSettings에 필드를 추가하며 넓혀간다.
import { useSyncExternalStore } from "react";

export interface MustardSettings {
  // 서브2~5에서 채운다. 예: terminalFontSize, defaultAgent, notifyAgentDone, confirmCloseRunningTerminal …
  [key: string]: unknown;
}

// 터미널 설정(#926) — 키·기본값 공유(Terminal[apps] + SettingsDrawer[packages] 둘 다 참조).
export type TerminalCursorStyle = "bar" | "block" | "underline";
export const TERMINAL_DEFAULTS = {
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  lineHeight: 1.0,
  cursorStyle: "bar" as TerminalCursorStyle,
  cursorBlink: true,
  scrollback: 1000,
  copyOnSelect: false,
  rightClickPaste: false,
  gpu: true,
};
export const TKEYS = {
  fontSize: "terminal.fontSize",
  fontFamily: "terminal.fontFamily",
  lineHeight: "terminal.lineHeight",
  cursorStyle: "terminal.cursorStyle",
  cursorBlink: "terminal.cursorBlink",
  scrollback: "terminal.scrollback",
  copyOnSelect: "terminal.copyOnSelect",
  rightClickPaste: "terminal.rightClickPaste",
  gpu: "terminal.gpu",
} as const;

const KEY = "mustard:settings";
type Listener = () => void;
const listeners = new Set<Listener>();

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeAll(obj: Record<string, unknown>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

// 단일 값 읽기 — 없으면 fallback. SSR/미저장 안전(readAll try/catch).
export function getSetting<T>(key: keyof MustardSettings & string, fallback: T): T {
  const all = readAll();
  return key in all ? (all[key] as T) : fallback;
}

// 단일 값 쓰기 + 구독자 통지.
export function setSetting(key: keyof MustardSettings & string, value: unknown): void {
  const all = readAll();
  all[key] = value;
  writeAll(all);
}

export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// React 훅 — 값 구독(설정 변경 시 리렌더). 클라이언트 전용.
export function useSetting<T>(key: keyof MustardSettings & string, fallback: T): T {
  return useSyncExternalStore(
    subscribeSettings,
    () => getSetting<T>(key, fallback),
    () => fallback, // 서버 스냅샷 = fallback(하이드레이션 안전)
  );
}
