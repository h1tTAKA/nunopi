// 분석결과 카테고리 목록(유튜브 재생목록式) — 유저가 만든 목록 정의.
// 목록 정의는 localStorage(가볍고 적음), 멤버십은 HistoryEntry.collectionIds(IndexedDB).
export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  // 이 목록이 속한 분석 모드. 코드/글 목록을 분리한다. 레거시(없음)는 "code"로 취급.
  mode?: "code" | "text";
}

const KEY = "nunopi:collections";

export function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is Collection =>
        typeof c === "object" && c !== null &&
        typeof (c as Collection).id === "string" &&
        typeof (c as Collection).name === "string",
    );
  } catch {
    return [];
  }
}

export function saveCollections(list: Collection[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
