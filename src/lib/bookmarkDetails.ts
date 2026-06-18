import type { CodeToken } from "@/lib/translator/types";

export interface BookmarkedTokenDetail extends CodeToken {
  bookmarkedAt: string;
}

const DETAILS_KEY = "nunopi:bookmark-token-details";

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
