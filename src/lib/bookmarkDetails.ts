import type { CodeToken, ItTerm } from "@/lib/translator/types";

export interface BookmarkedTokenDetail extends CodeToken {
  bookmarkedAt: string;
}

// 글(IT 용어) 모드 북마크 — 코드 토큰 북마크와 다른 키에 저장해 모드별로 분리한다.
export interface BookmarkedTermDetail extends ItTerm {
  bookmarkedAt: string;
}

const DETAILS_KEY = "nunopi:bookmark-token-details";
const TERM_DETAILS_KEY = "nunopi:bookmark-term-details";

export function saveTokenDetail(token: CodeToken): void {
  try {
    const existing = loadTokenDetails();
    existing[token.token] = { ...token, bookmarkedAt: new Date().toISOString() };
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

export function saveTermDetail(term: ItTerm): void {
  try {
    const existing = loadTermDetails();
    existing[term.term] = { ...term, bookmarkedAt: new Date().toISOString() };
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
