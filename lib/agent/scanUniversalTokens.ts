// 결정적 범용 토큰 스캐너(#505). LLM 추출은 목록에 있어도 랜덤하게 흘리므로, "고정 어휘"
// (언어 키워드 + 연산자)는 코드를 직접 토크나이즈해 100% 잡아낸다. 훅/API/메서드/JSX 태그
// 같은 문맥적 토큰은 모델이 담당(scanner는 안 건드림) → 겹침 없이 병합한다.
//
// 정확도: 문자열·주석 안의 단어는 세지 않는다(토크나이저가 그 구간을 통째 스킵). 연산자는
// 최장일치(===가 = 앞)로 잡는다. 줄번호는 매치 위치로 계산한다.
import type { CodeToken, TokenCategory } from "@/lib/translator/types";

// 예약어 + 원시 타입 키워드. 단어 경계로 매칭되므로 문자열/식별자 조각과 안 섞인다.
// get/set/of/as/from/type 등은 식별자로도 쓰일 수 있어 드물게 오탐이 있으나, 범용 학습
// 목적상 누락보다는 낫다(포함 우선).
const KEYWORDS = new Set<string>([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "default", "break", "continue", "try", "catch", "finally", "throw",
  "new", "delete", "typeof", "instanceof", "in", "of", "this", "super", "class",
  "extends", "implements", "interface", "type", "enum", "namespace", "declare",
  "async", "await", "yield", "void", "static", "get", "set", "public", "private",
  "protected", "readonly", "abstract", "import", "export", "from", "as",
  // 원시 타입/리터럴
  "string", "number", "boolean", "any", "unknown", "never", "null", "undefined",
  "object", "symbol", "bigint", "true", "false",
]);

// 의미 있는 연산자 — 최장일치 순서(긴 것 먼저)로 정렬. 괄호/쉼표/세미콜론/`.`(멤버 접근)
// 같은 순수 구두점은 학습 가치가 낮아 제외한다.
const OPERATORS = [
  ">>>=", "<<=", ">>=", "**=", "&&=", "||=", "??=", "===", "!==",
  "...", "=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--",
  "+=", "-=", "*=", "/=", "%=", "**", "<<", ">>",
  "=", "+", "-", "*", "/", "%", "<", ">", "!", "&", "|", "^", "~", "?", ":",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 스킵 구간(주석/문자열) → 식별자 → 연산자 순. 식별자를 연산자보다 먼저 둬 단어가 통째 매칭.
const SCAN_RE = new RegExp(
  [
    "\\/\\/[^\\n]*", // 라인 주석
    "\\/\\*[\\s\\S]*?\\*\\/", // 블록 주석
    "`(?:[^`\\\\]|\\\\.)*`", // 템플릿 문자열
    '"(?:[^"\\\\]|\\\\.)*"', // 큰따옴표 문자열
    "'(?:[^'\\\\]|\\\\.)*'", // 작은따옴표 문자열
    "[A-Za-z_$][A-Za-z0-9_$]*", // 식별자/키워드
    OPERATORS.map(escapeRegExp).join("|"), // 연산자(최장일치)
  ].join("|"),
  "g",
);

// 매치 시작 오프셋 → 1-based 줄번호. 개행 위치를 미리 계산해 이분탐색 대신 순차로.
function lineIndexer(code: string): (offset: number) => number {
  const starts: number[] = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === "\n") starts.push(i + 1);
  return (offset: number) => {
    // starts는 오름차순 — offset이 속한 줄 찾기(선형; 코드 한 파일이라 충분).
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

// 고정 어휘(키워드+연산자)를 코드에서 결정적으로 추출한다. label/description은 비운다
// (클릭 시 on-demand). id=token, bookmarkable=true.
export function scanUniversalTokens(code: string): CodeToken[] {
  const lineAt = lineIndexer(code);
  const map = new Map<string, Set<number>>();
  const category = new Map<string, TokenCategory>();
  for (const m of code.matchAll(SCAN_RE)) {
    const text = m[0];
    const first = text[0];
    // 주석/문자열 매치는 스킵(그 안의 단어는 세지 않음).
    if (first === "/" && (text[1] === "/" || text[1] === "*")) continue;
    if (first === '"' || first === "'" || first === "`") continue;
    const isWord = /[A-Za-z_$]/.test(first);
    if (isWord) {
      if (!KEYWORDS.has(text)) continue; // 키워드만(식별자·훅·API는 모델 담당)
      category.set(text, "keyword");
    } else {
      category.set(text, "operator");
    }
    const line = lineAt(m.index ?? 0);
    const set = map.get(text) ?? new Set<number>();
    set.add(line);
    map.set(text, set);
  }
  const out: CodeToken[] = [];
  for (const [token, lines] of map) {
    out.push({
      id: token,
      token,
      category: category.get(token) ?? "operator",
      label: "",
      description: "",
      lines: [...lines].sort((a, b) => a - b),
      bookmarkable: true,
    });
  }
  return out;
}

// 스캐너 토큰(고정 어휘) + 모델 토큰(문맥적)을 병합. token 텍스트 기준 dedupe, 스캐너를
// 앞에 둬 겹칠 경우 정확한 줄번호를 가진 스캐너 쪽이 남는다.
export function mergeUniversalTokens(scanned: CodeToken[], model: CodeToken[]): CodeToken[] {
  const seen = new Set<string>();
  const out: CodeToken[] = [];
  for (const t of [...scanned, ...model]) {
    if (seen.has(t.token)) continue;
    seen.add(t.token);
    out.push(t);
  }
  return out;
}
