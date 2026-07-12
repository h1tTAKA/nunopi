// 에이전트 질문(Ask) 모드 — 세션 히스토리 영속(이슈2).
// 세션(좌측 목록 항목) > 서브세션(subs, 탭) > 분할(layout, 타일)의 3층 모델.
// 서브세션 탭·분할은 후속 이슈(#3/#4)에서 활용 — 이번 이슈는 세션 목록만 쓰고
// subs는 항상 길이 1, layout은 활성 서브 1개로 초기화한다.
import type { ChatMessage } from "@/lib/agent";

const KEY = "nunopi:ask-sessions";
const LEGACY_THREAD_KEY = "nunopi:ask-thread"; // 이슈1 단일 스레드 — 최초 로드 시 흡수.

export interface AskSub {
  id: string;
  title?: string; // 유저 지정 이름. 없으면 "질문 N"으로 표시.
  messages: ChatMessage[];
}

export interface AskSession {
  id: string;
  title: string;
  createdAt: string; // ISO
  subs: AskSub[]; // ≥1
  activeSubId: string; // 탭 활성(이번 이슈엔 subs[0].id)
  layout: string[]; // 분할 표시 sub id들(이번 이슈엔 [activeSubId])
}

export interface AskStore {
  sessions: AskSession[];
  activeSessionId: string;
}

// crypto.randomUUID + 폴백(구형 환경). 다른 세션 모듈과 동일 관례.
export function newAskId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `ask-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

// 새 세션 하나 생성 — 서브세션 1개(빈 스레드), layout은 그 서브 단일.
export function createSession(title: string): AskSession {
  const sub: AskSub = { id: newAskId(), messages: [] };
  return {
    id: newAskId(),
    title,
    createdAt: new Date().toISOString(),
    subs: [sub],
    activeSubId: sub.id,
    layout: [sub.id],
  };
}

// 저장된 세션 배열이 스키마를 갖추도록 방어적으로 정규화.
function normalizeSession(raw: unknown): AskSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<AskSession>;
  if (typeof s.id !== "string") return null;
  const subs = Array.isArray(s.subs)
    ? s.subs
        .filter((x): x is AskSub => !!x && typeof (x as AskSub).id === "string")
        .map((x) => ({ id: x.id, title: typeof x.title === "string" ? x.title : undefined, messages: Array.isArray(x.messages) ? x.messages : [] }))
    : [];
  if (subs.length === 0) subs.push({ id: newAskId(), title: undefined, messages: [] });
  const activeSubId = subs.some((x) => x.id === s.activeSubId) ? s.activeSubId! : subs[0].id;
  const layout = Array.isArray(s.layout) && s.layout.some((id) => subs.some((x) => x.id === id))
    ? s.layout.filter((id) => subs.some((x) => x.id === id))
    : [activeSubId];
  return {
    id: s.id,
    title: typeof s.title === "string" ? s.title : "",
    createdAt: typeof s.createdAt === "string" ? s.createdAt : new Date().toISOString(),
    subs,
    activeSubId,
    layout,
  };
}

// 이슈1 단일 스레드(ask-thread) → 첫 세션으로 흡수 후 제거.
function migrateLegacyThread(fallbackTitle: string): AskSession | null {
  try {
    const raw = localStorage.getItem(LEGACY_THREAD_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as ChatMessage[];
    localStorage.removeItem(LEGACY_THREAD_KEY);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const session = createSession(fallbackTitle);
    session.subs[0].messages = arr;
    return session;
  } catch {
    return null;
  }
}

// 항상 활성 세션이 존재하도록 로드(빈 store면 세션 1개 자동 생성).
// fallbackTitle: 신규/마이그레이션 세션의 기본 제목(호출부에서 i18n으로 전달).
export function loadAskStore(fallbackTitle: string): AskStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AskStore>;
      const sessions = Array.isArray(parsed.sessions)
        ? parsed.sessions.map(normalizeSession).filter((s): s is AskSession => s !== null)
        : [];
      if (sessions.length > 0) {
        // 세션 스토어가 이미 있으면 레거시 스레드는 흡수 대상 아님 — 고아 방지 위해 정리.
        try { localStorage.removeItem(LEGACY_THREAD_KEY); } catch { /* ignore */ }
        const activeSessionId = sessions.some((s) => s.id === parsed.activeSessionId)
          ? parsed.activeSessionId!
          : sessions[0].id;
        return { sessions, activeSessionId };
      }
    }
    // store 없음 — 레거시 스레드 흡수 시도, 없으면 빈 세션 1개.
    const migrated = migrateLegacyThread(fallbackTitle);
    const first = migrated ?? createSession(fallbackTitle);
    return { sessions: [first], activeSessionId: first.id };
  } catch {
    const first = createSession(fallbackTitle);
    return { sessions: [first], activeSessionId: first.id };
  }
}

export function saveAskStore(store: AskStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}
