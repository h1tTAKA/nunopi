import type { CodeToken, ConceptOccurrence, ItTerm } from "@/lib/translator/types";

// 출처 종류 — 출처로 이동 목적지 분기용.
// analysis: 코드/글 분석(챗 세션까지). card: 플래시카드 챗에서 생성(생성처 카드로).
export type SourceKind = "analysis" | "card";

// 출처 부가 정보(옵셔널) — sourceTitle/sourceId 외 확장. 챗에서 카드 생성 시 채운다.
export interface SourceExtra {
  kind?: SourceKind;
  sessionId?: string; // analysis: 그 분석의 챗 세션 id
  originCardKey?: string; // card: 생성처(그 챗룸을 연) 카드 key
}

// 북마크 detail 공통 출처 필드(전부 옵셔널 — 기존 데이터 하위호환).
export interface SourceFields {
  sourceTitle?: string; // 담을 때의 분석 제목(출처)
  sourceId?: string; // 담을 때의 분석 히스토리 id(출처로 이동용)
  sourceKind?: SourceKind; // 없으면 analysis로 간주(기존 동작)
  sourceSessionId?: string; // analysis 출처의 챗 세션 id
  originCardKey?: string; // card 출처의 생성처 카드 key
}

export interface BookmarkedTokenDetail extends CodeToken, SourceFields {
  bookmarkedAt: string;
}

// 글(IT 용어) 모드 북마크 — 코드 토큰 북마크와 다른 키에 저장해 모드별로 분리한다.
export interface BookmarkedTermDetail extends ItTerm, SourceFields {
  bookmarkedAt: string;
}

// 개념 북마크 — 코드 모드 개념. 키 = 개념 title.
export interface BookmarkedConceptDetail extends ConceptOccurrence, SourceFields {
  bookmarkedAt: string;
}

// 저장 시 detail에 얹을 출처 필드 묶음.
function sourceFields(sourceTitle?: string, sourceId?: string, extra?: SourceExtra): SourceFields {
  return {
    sourceTitle,
    sourceId,
    sourceKind: extra?.kind,
    sourceSessionId: extra?.sessionId,
    originCardKey: extra?.originCardKey,
  };
}

const DETAILS_KEY = "nunopi:bookmark-token-details";
const TERM_DETAILS_KEY = "nunopi:bookmark-term-details";
const CONCEPT_DETAILS_KEY = "nunopi:bookmark-concept-details";

export function saveTokenDetail(token: CodeToken, sourceTitle?: string, sourceId?: string, extra?: SourceExtra): void {
  try {
    const existing = loadTokenDetails();
    existing[token.token] = { ...token, bookmarkedAt: new Date().toISOString(), ...sourceFields(sourceTitle, sourceId, extra) };
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

export function saveTermDetail(term: ItTerm, sourceTitle?: string, sourceId?: string, extra?: SourceExtra): void {
  try {
    const existing = loadTermDetails();
    existing[term.term] = { ...term, bookmarkedAt: new Date().toISOString(), ...sourceFields(sourceTitle, sourceId, extra) };
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

export function saveConceptDetail(concept: ConceptOccurrence, sourceTitle?: string, sourceId?: string, extra?: SourceExtra): void {
  try {
    const existing = loadConceptDetails();
    existing[concept.title] = { ...concept, bookmarkedAt: new Date().toISOString(), ...sourceFields(sourceTitle, sourceId, extra) };
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

// 완성된 detail을 그대로 기록(bookmarkedAt 등 보존) — 재분류(store 이동)용. save*는 bookmarkedAt=now라 부적합.
export function putTokenDetail(d: BookmarkedTokenDetail): void {
  try { const m = loadTokenDetails(); m[d.token] = d; localStorage.setItem(DETAILS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}
export function putTermDetail(d: BookmarkedTermDetail): void {
  try { const m = loadTermDetails(); m[d.term] = d; localStorage.setItem(TERM_DETAILS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}
export function putConceptDetail(d: BookmarkedConceptDetail): void {
  try { const m = loadConceptDetails(); m[d.title] = d; localStorage.setItem(CONCEPT_DETAILS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

// 이미 북마크(카드)로 존재하는 용어인지 — store 3종 아무 데나 있으면 true.
// 챗 카드 제안 칩에서 "이미 있는 카드"는 다시 제안 안 하도록 필터링용.
export function bookmarkedTermExists(term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  return !!(loadTokenDetails()[t] || loadConceptDetails()[t] || loadTermDetails()[t]);
}

// --- 출처 소급 채움 ---
// 이미 담긴 북마크(신규 추가가 아니라 예전에 담아 sourceTitle이 없는 것)를, 그 용어가
// 등장한 분석을 다시 볼 때 현재 분석 제목으로 채운다. 이미 값이 있으면 건드리지 않는다(최초 출처 보존).
// 반환: 하나라도 채웠으면 true(호출부가 화면 상태 갱신할지 판단).
function backfill<T extends { sourceTitle?: string; sourceId?: string }>(
  key: string,
  map: Record<string, T>,
  itemKey: string,
  title: string,
  id?: string,
): boolean {
  const entry = map[itemKey];
  if (!entry) return false;
  // 이미 sourceTitle 있으면 최초 출처 보존(제목은 손대지 않음). 단, id만 빠진 옛 데이터엔 id를 채운다.
  let changed = false;
  if (!entry.sourceTitle) { entry.sourceTitle = title; changed = true; }
  if (id && !entry.sourceId) { entry.sourceId = id; changed = true; }
  if (!changed) return false;
  try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* ignore */ }
  return true;
}

export function backfillTokenSource(tokenText: string, title: string, id?: string): boolean {
  return backfill(DETAILS_KEY, loadTokenDetails(), tokenText, title, id);
}
export function backfillTermSource(termText: string, title: string, id?: string): boolean {
  return backfill(TERM_DETAILS_KEY, loadTermDetails(), termText, title, id);
}
export function backfillConceptSource(title0: string, title: string, id?: string): boolean {
  return backfill(CONCEPT_DETAILS_KEY, loadConceptDetails(), title0, title, id);
}
