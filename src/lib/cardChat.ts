// 암기 카드별 학습 챗 — 카드마다 여러 세션(세션1/2/3…). 재방문 시 세션·스레드 보존.
import type { ChatMessage } from "@/lib/agent";

const KEY = "nunopi:card-chat";
// 세션 변경 알림 — 같은 카드의 여러 챗 인스턴스(확대 모달 챗 + 뒤 peek/세션 챗)를 동기화(유실 방지).
export const CARD_CHAT_CHANGED_EVENT = "nunopi:card-chat-changed";

// 카드 챗 세션 하나 — 고유 id + 스레드.
export interface CardChatSession {
  id: string;
  createdAt?: string; // ISO — 세션 생성 시각(전역 히스토리 타임라인용, #559). 옵셔널=하위호환.
  messages: ChatMessage[];
}

type Store = Record<string, CardChatSession[]>; // cardKey -> 세션 목록

export function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

function loadRaw(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// 한 카드의 세션 목록. 옛 형식(ChatMessage[])이면 세션 1개로 감싸 마이그레이션.
export function loadCardSessions(cardKey: string): CardChatSession[] {
  const val = loadRaw()[cardKey];
  if (!Array.isArray(val)) return [];
  if (val.length === 0) return [];
  // 신형: 원소가 {id, messages}. 옛형: 원소가 {role, content}.
  const first = val[0] as Record<string, unknown>;
  if (first && typeof first === "object" && "messages" in first) {
    return (val as CardChatSession[]).filter((s) => s && typeof s.id === "string" && Array.isArray(s.messages));
  }
  // 옛 단일 스레드 → 세션 1개.
  return [{ id: newSessionId(), createdAt: new Date().toISOString(), messages: val as ChatMessage[] }];
}

// 전역 히스토리 수집용 — 모든 카드의 세션 목록(cardKey → 세션들). loadCardSessions와 같은 정규화.
export function loadAllCardSessions(): Record<string, CardChatSession[]> {
  const raw = loadRaw();
  const out: Record<string, CardChatSession[]> = {};
  for (const key of Object.keys(raw)) {
    const list = loadCardSessions(key);
    if (list.length > 0) out[key] = list;
  }
  return out;
}

// 세션 목록 저장. 메시지 있는 세션이 하나도 없으면 key 삭제(정리). 변경 이벤트 발행.
export function saveCardSessions(cardKey: string, sessions: CardChatSession[]): void {
  try {
    const store = loadRaw() as Store;
    // 유의미 = 메시지 있는 세션이 있거나, 세션이 2개 이상(유저가 만든 빈 세션도 보존해야 재로드·동기화 시
    // 사라지거나 인스턴스 간 id가 갈리지 않음). fresh 단일 빈 세션만 정리(단일이라 발산 무해).
    const meaningful = sessions.some((s) => s.messages.length > 0) || sessions.length > 1;
    if (!meaningful) delete store[cardKey];
    else store[cardKey] = sessions;
    localStorage.setItem(KEY, JSON.stringify(store));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CARD_CHAT_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}
