// 에이전트 질문(Ask) 모드 — 단일 챗 스레드 영속(이슈1 뼈대).
// 이슈2에서 세션 배열(AskSession[])로 확장 예정. 지금은 단일 스레드만.
import type { ChatMessage } from "@/lib/agent";

const KEY = "nunopi:ask-thread";

export function loadAskThread(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveAskThread(messages: ChatMessage[]): void {
  try {
    if (messages.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}
