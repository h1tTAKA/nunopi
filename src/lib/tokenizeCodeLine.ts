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

// 한 줄 → distinct 토큰 배열(등장 순서 유지). 같은 줄 내 중복 텍스트는 1개만
// (칩 두 개여도 클릭 결과 동일 → 노이즈). 칩 key로도 안전.
export function tokenizeCodeLine(code: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of code.matchAll(TOKEN_RE)) {
    const token = match[0];
    if (!seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}
