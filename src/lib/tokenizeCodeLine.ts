// 코드 한 줄을 토큰으로 쪼갠다. 줄별 설명 밑의 토큰 칩(클릭 시 explain-token으로
// on-demand 설명, #86)을 모델 출력이 아니라 클라에서 직접 만들기 위함.
// 토큰 텍스트는 코드에서 결정적으로 추출되므로 모델이 만들 필요가 없다 →
// 출력 토큰 절감 + 누락 0 + 공백 뺀 전부.
//
// 매칭 우선순위: 문자열 리터럴(통째) → 식별자/키워드 → 숫자 → 멀티문자 연산자
// → 그 외 비공백 단일 문자(구두점/연산자). 공백은 매칭 안 됨(자동 제외).
// u 플래그 + \p{L}로 한글 등 비ASCII 식별자도 한 토큰으로(글자별 분해 방지).
const TOKEN_RE =
  /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[\p{L}_$][\p{L}\p{N}_$]*|\d[\d._]*|=>|\?\?|\?\.|\.\.\.|&&|\|\||===|!==|==|!=|<=|>=|\+\+|--|[^\s]/gu;

// 한 클래스 토큰 모양: 소문자/숫자 시작 + 이후 소문자·숫자·`:`(variant)·`/`(opacity)
// ·`-`·`.`·`[` `]`(arbitrary value)만. tailwind류 클래스명 전부 커버. 대문자·공백·기타
// 기호(산문/문장/`${}`)는 불일치 → 통째 유지.
const CLASS_WORD_RE = /^[a-z0-9][a-z0-9:/._[\]-]*$/;

// 문자열/템플릿 리터럴 content를 정적 텍스트 조각과 `${...}` 보간으로 나눈다.
// 템플릿 안 보간은 중괄호 중첩(`${a ? {x:1} : 0}`)까지 균형 맞춰 하나로 묶는다.
type LiteralPart = { type: "text" | "interp"; value: string };
function splitLiteralParts(content: string): LiteralPart[] {
  const parts: LiteralPart[] = [];
  let i = 0;
  while (i < content.length) {
    if (content[i] === "$" && content[i + 1] === "{") {
      let depth = 0;
      let j = i + 1;
      let closed = false;
      for (; j < content.length; j++) {
        if (content[j] === "{") depth++;
        else if (content[j] === "}") {
          depth--;
          if (depth === 0) {
            j++;
            closed = true;
            break;
          }
        }
      }
      if (!closed) {
        // 미종결 `${`(비정상 입력) — 나머지를 통째 text로. 정상 코드에선 안 나옴.
        parts.push({ type: "text", value: content.slice(i) });
        break;
      }
      parts.push({ type: "interp", value: content.slice(i + 2, j - 1) }); // ${ } 벗긴 내부 식
      i = j;
    } else {
      let j = i;
      while (j < content.length && !(content[j] === "$" && content[j + 1] === "{")) j++;
      parts.push({ type: "text", value: content.slice(i, j) });
      i = j;
    }
  }
  return parts;
}

// 토큰이 문자열/템플릿 리터럴이고 내부가 "클래스 나열"이면 조각별 토큰 배열을, 아니면
// null(통째 유지). tailwind 클래스는 하나하나 의미가 있어 개별 칩으로 클릭·질문 가능해야
// 한다(#501). `${...}` 보간이 섞여도(예: `flex ${TONES[tone]}`) 정적 클래스는 쪼개고,
// 보간 내부 식은 따로 토큰화해 칩으로 낸다. 정적 단어 중 하나라도 클래스 모양이 아니면
// (산문 `Hello world`, `` `Hello ${x}` ``) 통째 유지.
function splitIfClassList(token: string): string[] | null {
  if (token.length < 2) return null;
  const quote = token[0];
  if ((quote !== '"' && quote !== "'" && quote !== "`") || token[token.length - 1] !== quote) {
    return null;
  }
  const parts = splitLiteralParts(token.slice(1, -1));
  const hasInterp = parts.some((p) => p.type === "interp");
  const staticWords = parts
    .filter((p) => p.type === "text")
    .flatMap((p) => p.value.split(/\s+/).filter((w) => w.length > 0));
  // 보간 없고 단어 1개면 원래도 칩 하나 → 통째. (보간 있으면 클래스+식이라 쪼갤 가치)
  if (!hasInterp && staticWords.length < 2) return null;
  // 정적 단어가 하나라도 클래스 모양이 아니면 산문으로 보고 통째.
  if (!staticWords.every((w) => CLASS_WORD_RE.test(w))) return null;
  // 클래스 나열 확정: 등장 순서대로 정적 클래스 + 보간 내부 식 토큰.
  const out: string[] = [];
  for (const p of parts) {
    if (p.type === "text") {
      for (const w of p.value.split(/\s+/).filter((w) => w.length > 0)) out.push(w);
    } else {
      for (const t of tokenizeCodeLine(p.value)) out.push(t); // 보간 내부 식은 일반 토큰화
    }
  }
  return out;
}

// 한 줄 → distinct 토큰 배열(등장 순서 유지). 같은 줄 내 중복 텍스트는 1개만
// (칩 두 개여도 클릭 결과 동일 → 노이즈). 칩 key로도 안전.
export function tokenizeCodeLine(code: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (token: string) => {
    if (!seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  };
  for (const match of code.matchAll(TOKEN_RE)) {
    const token = match[0];
    const classWords = splitIfClassList(token);
    if (classWords) {
      for (const w of classWords) push(w); // 클래스 나열 → 클래스별 칩
    } else {
      push(token);
    }
  }
  return out;
}
