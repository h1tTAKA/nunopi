import type { ItTerm } from "@/lib/translator/types";

// 글 원문을 "평문 / 용어" 세그먼트로 쪼갠다. 분석된 IT 용어가 글에 등장하는 위치를 찾아
// 클릭 가능한 조각으로 표시하기 위함. 순수 함수(테스트 쉬움).
export interface TextSegment {
  text: string;
  termId?: string; // 있으면 그 용어로 하이라이트/클릭.
}

// ASCII(영문/숫자)로만 된 후보는 단어 경계에서만 매칭한다 — "AI"가 "TRAIN" 속에,
// "RAG"가 "STORAGE" 속에 잡히는 오버매칭을 막는다. 한글 등 섞인 건 그대로 부분 매칭.
function isAsciiTerm(term: string): boolean {
  return /^[\x00-\x7F]+$/.test(term);
}

function isWordChar(ch: string | undefined): boolean {
  return ch != null && /[A-Za-z0-9]/.test(ch);
}

// 한 용어에서 원문 매칭 후보를 뽑는다(#521). 모델이 term을 "surrogate (서러게이트)"처럼
// 병기해 저장하면 원문의 "surrogate"·"서러게이트" 어느 쪽과도 정확 일치 안 하므로,
// term·reading 각각에서 ①전체 ②괄호 앞 부분 ③괄호 안 내용을 후보로 쪼갠다.
function candidatesOf(t: ItTerm): string[] {
  const out: string[] = [];
  for (const raw of [t.term, t.reading]) {
    if (!raw) continue;
    const full = raw.trim();
    if (full) out.push(full);
    const before = full.replace(/\s*\(.*$/, "").trim(); // 괄호 앞
    if (before) out.push(before);
    for (const m of full.matchAll(/\(([^)]+)\)/g)) {   // 괄호 안 내용
      const inner = m[1].trim();
      if (inner) out.push(inner);
    }
  }
  // 너무 짧은 것(1자)·중복 제거.
  return [...new Set(out.filter((s) => s.length >= 2))];
}

export function highlightTerms(code: string, terms: ItTerm[]): TextSegment[] {
  // (후보텍스트, termId) 목록. 긴 후보 우선(짧은 게 긴 걸 가로채지 않게).
  const cands: { text: string; id: string; ascii: boolean }[] = [];
  const seen = new Set<string>();
  for (const t of terms) {
    for (const c of candidatesOf(t)) {
      const key = c.toLowerCase();
      if (seen.has(key)) continue; // 같은 후보 텍스트는 한 번만(첫 용어에 귀속)
      seen.add(key);
      cands.push({ text: c, id: t.id, ascii: isAsciiTerm(c) });
    }
  }
  cands.sort((a, b) => b.text.length - a.text.length);

  if (cands.length === 0) return code ? [{ text: code }] : [];

  const lower = code.toLowerCase(); // 대소문자 무시 매칭용(표시는 원본 code).
  const segments: TextSegment[] = [];
  let plainStart = 0;
  let i = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) segments.push({ text: code.slice(plainStart, end) });
  };

  while (i < code.length) {
    let matched: { id: string; len: number } | null = null;
    for (const c of cands) {
      const len = c.text.length;
      if (lower.startsWith(c.text.toLowerCase(), i)) {
        if (c.ascii) {
          // ASCII 후보는 양옆이 영숫자가 아니어야 한다(단어 경계). 한글 조사 등은 경계로 인정.
          const before = i > 0 ? code[i - 1] : undefined;
          const after = i + len < code.length ? code[i + len] : undefined;
          if (isWordChar(before) || isWordChar(after)) continue;
        }
        matched = { id: c.id, len };
        break;
      }
    }
    if (matched) {
      flushPlain(i);
      segments.push({ text: code.slice(i, i + matched.len), termId: matched.id });
      i += matched.len;
      plainStart = i;
    } else {
      i += 1;
    }
  }
  flushPlain(code.length);
  return segments;
}
