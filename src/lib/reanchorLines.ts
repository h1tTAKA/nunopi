import type { AgentLineExplanation } from "@/lib/agent";

// LLM이 매긴 lineExplanations[].line은 부정확하다(LLM은 줄 세기를 못 함).
// 신뢰 가능한 건 각 설명의 code 텍스트 → 실제 입력 코드에서 그 줄을 찾아
// 실제 1-based 행번호로 재앵커한다. 못 찾으면 LLM line을 그대로 둔다(폴백).
//
// lineMap(원래 line → 실제 line)을 함께 반환해, 토큰/개념의 lines처럼 같은
// LLM 좌표계를 쓰는 다른 참조도 보정할 수 있게 한다.

export interface ReanchorResult {
  lineExplanations: AgentLineExplanation[];
  lineMap: Map<number, number>;
}

export function reanchorLineNumbers(
  code: string,
  lineExplanations: AgentLineExplanation[],
): ReanchorResult {
  const codeLines = code.split(/\r?\n/);
  const trimmed = codeLines.map((l) => l.trim());
  const used = new Array<boolean>(codeLines.length).fill(false);
  const lineMap = new Map<number, number>();
  let searchStart = 0;

  const anchored = lineExplanations.map((exp) => {
    const target = exp.code.trim();
    let actual = exp.line;
    if (target) {
      // 미사용 줄 중 pred 만족 첫 인덱스 — searchStart 이후 우선, 없으면 처음부터.
      const findFrom = (pred: (s: string) => boolean): number => {
        for (let i = searchStart; i < trimmed.length; i++) if (!used[i] && pred(trimmed[i])) return i;
        for (let i = 0; i < trimmed.length; i++) if (!used[i] && pred(trimmed[i])) return i;
        return -1;
      };
      // 1) 정확 일치. 2) 실패 시 느슨한 접두 일치(모델 축약/상이 대비, 짧은 target 제외).
      let j = findFrom((s) => s === target);
      if (j === -1) {
        const loose = target.replace(/\s*(?:\.\.\.|…)\s*$/, "").trim(); // 후행 생략부호 제거
        if (loose.length >= 4) j = findFrom((s) => s.startsWith(loose) || loose.startsWith(s));
      }
      if (j >= 0) {
        actual = j + 1;
        used[j] = true;
        searchStart = j + 1;
      }
    }
    lineMap.set(exp.line, actual);
    return actual === exp.line ? exp : { ...exp, line: actual };
  });

  // 실제 행번호 오름차순 정렬 — 방출 순서와 무관하게 코드 순서대로. stable.
  anchored.sort((a, b) => a.line - b.line);

  return { lineExplanations: anchored, lineMap };
}

// 토큰/개념의 lines(LLM 좌표계)를 lineMap으로 보정. 맵에 없으면 원값 유지.
export function remapLines(lines: number[], lineMap: Map<number, number>): number[] {
  return lines.map((l) => lineMap.get(l) ?? l);
}
