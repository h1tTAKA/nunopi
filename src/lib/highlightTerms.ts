import type { ItTerm } from "@/lib/translator/types";

// 글 원문을 "평문 / 용어" 세그먼트로 쪼갠다. 분석된 IT 용어(term 문자열)가 글에
// 등장하는 위치를 찾아 클릭 가능한 조각으로 표시하기 위함. 순수 함수(테스트 쉬움).
export interface TextSegment {
  text: string;
  termId?: string; // 있으면 그 용어로 하이라이트/클릭.
}

// ASCII(영문/숫자)로만 된 용어는 단어 경계에서만 매칭한다 — "AI"가 "TRAIN" 속에,
// "RAG"가 "STORAGE" 속에 잡히는 오버매칭을 막는다. 한글이 섞인 용어는 경계 개념이
// 약하므로 그대로 부분 매칭한다.
function isAsciiTerm(term: string): boolean {
  return /^[\x00-\x7F]+$/.test(term);
}

function isWordChar(ch: string | undefined): boolean {
  return ch != null && /[A-Za-z0-9]/.test(ch);
}

export function highlightTerms(code: string, terms: ItTerm[]): TextSegment[] {
  // 빈 term 제외 + 길이 내림차순(긴 용어 우선 — 짧은 게 긴 걸 가로채지 않게).
  const sorted = terms
    .filter((t) => t.term && t.term.trim().length > 0)
    .slice()
    .sort((a, b) => b.term.length - a.term.length);

  if (sorted.length === 0) return code ? [{ text: code }] : [];

  const segments: TextSegment[] = [];
  let plainStart = 0; // 아직 세그먼트로 안 넣은 평문 시작 위치.
  let i = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) segments.push({ text: code.slice(plainStart, end) });
  };

  while (i < code.length) {
    let matched: ItTerm | null = null;
    for (const t of sorted) {
      const len = t.term.length;
      if (code.startsWith(t.term, i)) {
        // ASCII 용어는 양옆이 영숫자가 아니어야 한다(단어 경계).
        if (isAsciiTerm(t.term)) {
          const before = i > 0 ? code[i - 1] : undefined;
          const after = i + len < code.length ? code[i + len] : undefined;
          if (isWordChar(before) || isWordChar(after)) continue;
        }
        matched = t;
        break;
      }
    }
    if (matched) {
      flushPlain(i);
      segments.push({ text: code.slice(i, i + matched.term.length), termId: matched.id });
      i += matched.term.length;
      plainStart = i;
    } else {
      i += 1;
    }
  }
  flushPlain(code.length);
  return segments;
}
