import type { AgentProviderKind } from "@mustard/core";
import { PROVIDER_CATALOG } from "./agent/catalog";

// 학습모듈 모드별 provider(#985). 모드 값이 없으면 default, default도 없으면 claude-agent.
// 코드/글은 입력창 드롭다운이 여기에 저장하고, 질문·히스토리·암기는 설정 화면에서 고른다.
export type LearnProviderMode = "code" | "text" | "ask" | "history" | "memorize";
export type ModeProviders = Partial<Record<LearnProviderMode | "default", AgentProviderKind>>;

export const LEARN_PROVIDER_MODES: readonly LearnProviderMode[] = ["code", "text", "ask", "history", "memorize"];
export const DEFAULT_LEARN_PROVIDER: AgentProviderKind = "claude-agent";

const KEY = "nunopi:mode-providers";
const OLD_MEMORIZE_KEY = "nunopi:memorize-provider"; // #985 이전 암기 전용 키 — 1회 이관

const isKnown = (v: unknown): v is AgentProviderKind => PROVIDER_CATALOG.some((p) => p.id === v);

export function loadModeProviders(): ModeProviders {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    const out: ModeProviders = {};
    if (parsed && typeof parsed === "object") {
      // 손상·삭제된 provider 값은 버려서 default로 떨어지게.
      for (const k of ["default", ...LEARN_PROVIDER_MODES] as const) {
        const v = (parsed as Record<string, unknown>)[k];
        if (isKnown(v)) out[k] = v;
      }
    }
    const old = localStorage.getItem(OLD_MEMORIZE_KEY);
    if (old !== null) {
      if (!out.memorize && isKnown(old)) out.memorize = old;
      localStorage.setItem(KEY, JSON.stringify(out));
      localStorage.removeItem(OLD_MEMORIZE_KEY);
    }
    return out;
  } catch {
    return {};
  }
}

export function saveModeProviders(map: ModeProviders): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function resolveModeProvider(map: ModeProviders, mode: LearnProviderMode | "default"): AgentProviderKind {
  return map[mode] ?? map.default ?? DEFAULT_LEARN_PROVIDER;
}
