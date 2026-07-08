// 암기 카드별 학습 챗 스레드 영속 — 카드마다 고유 세션. 재방문 시 이전 질문/답변 보존.
import type { ChatMessage } from "@/lib/agent";

const KEY = "nunopi:card-chat";

type Map = Record<string, ChatMessage[]>; // cardKey -> 스레드

function load(): Map {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Map) : {};
  } catch {
    return {};
  }
}

export function loadCardChat(cardKey: string): ChatMessage[] {
  return load()[cardKey] ?? [];
}

export function saveCardChat(cardKey: string, messages: ChatMessage[]): void {
  try {
    const m = load();
    if (messages.length === 0) delete m[cardKey];
    else m[cardKey] = messages;
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}
