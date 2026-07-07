import type { CodeToken, ConceptOccurrence, ItTerm } from "@/lib/translator/types";

export interface BookmarkedTokenDetail extends CodeToken {
  bookmarkedAt: string;
  sourceTitle?: string; // 담을 때의 분석 제목(출처, 옵셔널 — 기존 데이터 하위호환)
}

// 글(IT 용어) 모드 북마크 — 코드 토큰 북마크와 다른 키에 저장해 모드별로 분리한다.
export interface BookmarkedTermDetail extends ItTerm {
  bookmarkedAt: string;
  sourceTitle?: string;
}

// 개념 북마크 — 코드 모드 개념. 키 = 개념 title.
export interface BookmarkedConceptDetail extends ConceptOccurrence {
  bookmarkedAt: string;
  sourceTitle?: string;
}

const DETAILS_KEY = "nunopi:bookmark-token-details";
const TERM_DETAILS_KEY = "nunopi:bookmark-term-details";
const CONCEPT_DETAILS_KEY = "nunopi:bookmark-concept-details";

export function saveTokenDetail(token: CodeToken, sourceTitle?: string): void {
  try {
    const existing = loadTokenDetails();
    existing[token.token] = { ...token, bookmarkedAt: new Date().toISOString(), sourceTitle };
    localStorage.setItem(DETAILS_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

export function removeTokenDetail(tokenText: string): void {
  try {
    const existing = loadTokenDetails();
    delete existing[tokenText];
    localStorage.setItem(DETAILS_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

export function loadTokenDetails(): Record<string, BookmarkedTokenDetail> {
  try {
    const raw = localStorage.getItem(DETAILS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, BookmarkedTokenDetail>) : {};
  } catch {
    return {};
  }
}

export function clearTokenDetails(): void {
  try { localStorage.removeItem(DETAILS_KEY); } catch { /* ignore */ }
}

// --- 글 모드 IT 용어 북마크 (키 = term 문자열) ---

export function saveTermDetail(term: ItTerm, sourceTitle?: string): void {
  try {
    const existing = loadTermDetails();
    existing[term.term] = { ...term, bookmarkedAt: new Date().toISOString(), sourceTitle };
    localStorage.setItem(TERM_DETAILS_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

export function removeTermDetail(termText: string): void {
  try {
    const existing = loadTermDetails();
    delete existing[termText];
    localStorage.setItem(TERM_DETAILS_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

export function loadTermDetails(): Record<string, BookmarkedTermDetail> {
  try {
    const raw = localStorage.getItem(TERM_DETAILS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, BookmarkedTermDetail>) : {};
  } catch {
    return {};
  }
}

export function clearTermDetails(): void {
  try { localStorage.removeItem(TERM_DETAILS_KEY); } catch { /* ignore */ }
}

// --- 개념 북마크 (키 = 개념 title) ---

export function saveConceptDetail(concept: ConceptOccurrence, sourceTitle?: string): void {
  try {
    const existing = loadConceptDetails();
    existing[concept.title] = { ...concept, bookmarkedAt: new Date().toISOString(), sourceTitle };
    localStorage.setItem(CONCEPT_DETAILS_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

export function removeConceptDetail(title: string): void {
  try {
    const existing = loadConceptDetails();
    delete existing[title];
    localStorage.setItem(CONCEPT_DETAILS_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

export function loadConceptDetails(): Record<string, BookmarkedConceptDetail> {
  try {
    const raw = localStorage.getItem(CONCEPT_DETAILS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, BookmarkedConceptDetail>) : {};
  } catch {
    return {};
  }
}

export function clearConceptDetails(): void {
  try { localStorage.removeItem(CONCEPT_DETAILS_KEY); } catch { /* ignore */ }
}

// --- 출처 소급 채움 ---
// 이미 담긴 북마크(신규 추가가 아니라 예전에 담아 sourceTitle이 없는 것)를, 그 용어가
// 등장한 분석을 다시 볼 때 현재 분석 제목으로 채운다. 이미 값이 있으면 건드리지 않는다(최초 출처 보존).
// 반환: 하나라도 채웠으면 true(호출부가 화면 상태 갱신할지 판단).
function backfill<T extends { sourceTitle?: string }>(
  key: string,
  map: Record<string, T>,
  itemKey: string,
  title: string,
): boolean {
  const entry = map[itemKey];
  if (!entry || entry.sourceTitle) return false;
  entry.sourceTitle = title;
  try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* ignore */ }
  return true;
}

export function backfillTokenSource(tokenText: string, title: string): boolean {
  return backfill(DETAILS_KEY, loadTokenDetails(), tokenText, title);
}
export function backfillTermSource(termText: string, title: string): boolean {
  return backfill(TERM_DETAILS_KEY, loadTermDetails(), termText, title);
}
export function backfillConceptSource(title0: string, title: string): boolean {
  return backfill(CONCEPT_DETAILS_KEY, loadConceptDetails(), title0, title);
}
