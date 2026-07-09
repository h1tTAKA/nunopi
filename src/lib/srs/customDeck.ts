// 커스텀 덱 — 유저(또는 에이전트)가 큐레이션한 카드 key 목록. 고정 덱(code/text/all)과 별개 축.
// 카드는 key로만 참조(내용은 collectCards에서 파생). 삭제된 카드 key는 세션/카운트 시 스킵.
const KEY = "nunopi:mem-custom-decks";
// 커스텀 덱 목록 변경 알림 — DeckSelect 등이 재로드하도록.
export const CUSTOM_DECKS_CHANGED_EVENT = "nunopi:custom-decks-changed";

export interface CustomDeck {
  id: string;
  name: string;
  cardKeys: string[];
  goal?: string; // 에이전트 생성 시 유저 목표 프롬프트(참고)
  createdAt: string;
}

export function loadCustomDecks(): CustomDeck[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as CustomDeck[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveAll(list: CustomDeck[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CUSTOM_DECKS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `deck-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

export function addCustomDeck(name: string, cardKeys: string[], goal?: string): CustomDeck {
  const deck: CustomDeck = {
    id: newId(),
    name: name.trim() || "덱",
    cardKeys: [...new Set(cardKeys)], // 중복 제거
    goal,
    createdAt: new Date().toISOString(),
  };
  saveAll([...loadCustomDecks(), deck]);
  return deck;
}

export function removeCustomDeck(id: string): void {
  saveAll(loadCustomDecks().filter((d) => d.id !== id));
}
