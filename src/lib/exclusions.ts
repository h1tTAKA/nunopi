import type { AnalyzeMode } from "@/lib/agent";

// 분석 결과에서 "더 이상 설명 안 해줬으면 하는" 토큰/용어를 모드별로 제외(차단)한다.
// 코드 토큰은 token 텍스트, 글 IT 용어는 term 텍스트로 식별해 localStorage에 저장.
const TOKENS_KEY = "nunopi:excluded-tokens";
const TERMS_KEY = "nunopi:excluded-terms";

function keyFor(mode: AnalyzeMode): string {
  return mode === "text" ? TERMS_KEY : TOKENS_KEY;
}

export function loadExclusions(mode: AnalyzeMode): string[] {
  try {
    const raw = localStorage.getItem(keyFor(mode));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveExclusions(mode: AnalyzeMode, list: string[]): void {
  try {
    localStorage.setItem(keyFor(mode), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
