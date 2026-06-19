import type {
  AgentAnalyzeRequest,
  AgentAnalyzeResponse,
  AgentLineExplanation,
} from "./schema";
import type { CodeToken, ConceptOccurrence, TokenCategory } from "@/lib/translator/types";
import type { AgentProvider } from "./types";
import { textModeResponse } from "./textMode";
import { tokenModeResponse } from "./tokenMode";
import { conceptModeResponse } from "./conceptMode";

const HOOK_PATTERN = /\b(useState|useEffect|useMemo|useCallback|useRef)\s*\(/;
const JSX_PATTERN = /<\s*[A-Za-z][\w-]*(?:\s|>|\/)/;
const CLASS_NAME_PATTERN = /className\s*=/;
const FUNCTION_PATTERN = /^\s*function\s+[A-Za-z_$][\w$]*\s*\(/;
const VARIABLE_PATTERN = /^\s*(const|let|var)\s+/;
const RETURN_PATTERN = /^\s*return\b/;
const ARROW_FUNCTION_PATTERN = /=>/;
const FUNCTION_NAME_PATTERN = /^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/;
const VARIABLE_NAME_PATTERN = /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/;
const HOOK_NAME_PATTERN = /\b(useState|useEffect|useMemo|useCallback|useRef)\b/;
const JSX_TAG_NAME_PATTERN = /<\s*([A-Za-z][\w-]*)/;
const CLASS_NAME_DIRECT_VALUE_PATTERN = /className\s*=\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/;
const CLASS_NAME_EXPRESSION_PATTERN = /className\s*=\s*\{([^}]*)\}/;
const TAILWIND_UTILITY_PATTERN =
  /\b(?:flex|grid|items-center|justify-center|gap-\d+|p[trblxy]?-[\d.]+|m[trblxy]?-[\d.]+|bg-[\w-]+|text-[\w-]+|rounded(?:-[\w]+)?|w-\d+|h-\d+|sm:[\w-]+|md:[\w-]+|lg:[\w-]+|xl:[\w-]+|hover:[\w-]+|focus:[\w-]+|disabled:[\w-]+)\b/g;

export const localRulesProvider: AgentProvider = {
  metadata: {
    id: "local-rules",
    label: "Local Rules",
    description: "Built-in rule-based analysis without external API calls.",
    executionLocation: "browser",
    dataHandling: "local-only",
    capabilities: {
      streaming: false,
      cancellation: false,
      fileSystemAccess: false,
      shellAccess: false,
      requiresApiKey: false,
      requiresLocalProcess: false,
    },
  },
  async analyze(request: AgentAnalyzeRequest): Promise<AgentAnalyzeResponse> {
    // 로컬 규칙 분석은 개념 설명을 만들지 않는다 — explain-concept은 안내만.
    if (request.mode === "explain-concept") {
      const c = request.targetConcept ?? "";
      return conceptModeResponse(
        this.metadata.id,
        c
          ? [{ conceptId: c, title: c, lines: [], count: 0, description: "로컬 규칙 분석은 개념 상세 설명을 제공하지 않는다. 상단에서 AI 프로바이더를 선택해 보라." }]
          : [],
        [],
      );
    }
    // 로컬 규칙 분석은 토큰 상세 설명을 만들지 않는다 — explain-token은 안내만.
    if (request.mode === "explain-token") {
      const t = request.targetToken ?? "";
      return tokenModeResponse(
        this.metadata.id,
        t
          ? [{
              id: t,
              token: t,
              category: "keyword",
              label: "토큰",
              description: "로컬 규칙 분석은 토큰 상세 설명을 제공하지 않는다. 상단에서 AI 프로바이더를 선택해 보라.",
              lines: [],
              bookmarkable: true,
            }]
          : [],
        [],
      );
    }
    // 로컬 규칙 분석은 코드 전용 — 글(IT 용어) 모드는 AI 프로바이더가 필요하다.
    if (request.mode === "text") {
      return textModeResponse(
        this.metadata.id,
        "글(IT 용어) 분석은 AI 프로바이더가 필요하다. 상단에서 Claude / Codex / OpenAI 호환 프로바이더를 선택해 보라.",
        [
          {
            code: "PARTIAL_PARSE",
            message: "Local Rules provider does not support text mode; choose an AI provider.",
          },
        ],
      );
    }
    const lineExplanations = buildLineExplanations(request.code);
    const matchedLineCount = lineExplanations.length;
    const totalNonEmptyLines = countNonEmptyLines(request.code);
    const tokens = buildTokens(request.code, lineExplanations);
    const concepts = buildConceptOccurrences(lineExplanations, tokens);

    return {
      providerId: this.metadata.id,
      mode: "code",
      language: request.detectedLanguage ?? "unknown",
      summary: buildSummary(totalNonEmptyLines, matchedLineCount),
      lineExplanations,
      tokens,
      concepts,
      warnings: buildWarnings(totalNonEmptyLines, matchedLineCount),
      createdAt: new Date().toISOString(),
    };
  },
};

function buildLineExplanations(code: string): AgentLineExplanation[] {
  const lines = code.split(/\r?\n/);

  return lines.flatMap((sourceLine, index) => {
    const trimmedLine = sourceLine.trim();

    if (!trimmedLine) {
      return [];
    }

    const explanation = buildLineExplanation(trimmedLine);

    if (!explanation) {
      return [];
    }

    return [
      {
        line: index + 1,
        code: sourceLine,
        explanation: explanation.text,
        tokenIds: explanation.tokenIds,
        conceptIds: explanation.conceptIds,
        confidence: explanation.confidence,
      },
    ];
  });
}

function buildLineExplanation(
  line: string,
): {
  text: string;
  tokenIds: string[];
  conceptIds: string[];
  confidence: number;
} | null {
  if (HOOK_PATTERN.test(line) && VARIABLE_PATTERN.test(line)) {
    return {
      text: "React hook 값을 변수에 담아, 이후 화면 상태나 참조 값을 계속 사용할 준비를 하는 줄이다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["react-hook", "state-or-reference"],
      confidence: 0.96,
    };
  }

  if (HOOK_PATTERN.test(line)) {
    return {
      text: "React hook을 호출해서 상태, 효과, 메모이제이션 같은 React 기능을 연결하는 줄이다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["react-hook"],
      confidence: 0.94,
    };
  }

  if (FUNCTION_PATTERN.test(line)) {
    return {
      text: "이름이 있는 함수를 선언해서, 나중에 같은 로직을 여러 번 호출할 수 있게 만드는 줄이다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["function"],
      confidence: 0.93,
    };
  }

  if (VARIABLE_PATTERN.test(line) && ARROW_FUNCTION_PATTERN.test(line)) {
    return {
      text: "변수에 화살표 함수를 저장해서, 나중에 함수처럼 호출할 수 있게 준비하는 줄이다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["function", "arrow-function"],
      confidence: 0.91,
    };
  }

  if (VARIABLE_PATTERN.test(line)) {
    return {
      text: "값을 저장할 변수를 선언하는 줄이다. 이후 다른 줄에서 이 이름을 다시 사용하게 된다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["variable"],
      confidence: 0.88,
    };
  }

  if (RETURN_PATTERN.test(line) && JSX_PATTERN.test(line)) {
    return {
      text: "JSX 화면 조각을 return 해서, 이 컴포넌트가 실제로 어떤 UI를 그릴지 돌려주는 줄이다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["return", "jsx-rendering"],
      confidence: 0.96,
    };
  }

  if (RETURN_PATTERN.test(line)) {
    return {
      text: "함수 실행 결과를 바깥으로 돌려주는 return 줄이다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["return"],
      confidence: 0.9,
    };
  }

  if (CLASS_NAME_PATTERN.test(line) && JSX_PATTERN.test(line)) {
    return {
      text: "JSX 요소에 className을 붙여서, 이 화면 조각의 스타일 규칙을 연결하는 줄이다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["jsx", "styling"],
      confidence: 0.9,
    };
  }

  if (JSX_PATTERN.test(line)) {
    return {
      text: "JSX 태그를 사용해서 화면에 렌더링될 요소 구조를 적는 줄이다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["jsx", "ui-structure"],
      confidence: 0.87,
    };
  }

  if (ARROW_FUNCTION_PATTERN.test(line)) {
    return {
      text: "화살표 함수 문법을 사용해서 짧은 함수 로직을 표현하는 줄이다.",
      tokenIds: collectLineTokenIds(line),
      conceptIds: ["arrow-function"],
      confidence: 0.84,
    };
  }

  return null;
}

function buildSummary(totalNonEmptyLines: number, matchedLineCount: number): string {
  if (matchedLineCount === 0) {
    return "Local rules provider found no supported beginner-friendly patterns in this code yet.";
  }

  return `Local rules provider generated explanations for ${matchedLineCount} of ${totalNonEmptyLines} non-empty lines.`;
}

function buildWarnings(totalNonEmptyLines: number, matchedLineCount: number) {
  if (matchedLineCount === 0) {
    return [
      {
        code: "PARTIAL_PARSE" as const,
        message: "Local rules provider is connected, but no beginner-friendly rule matched this code yet.",
      },
    ];
  }

  if (matchedLineCount < totalNonEmptyLines) {
    return [
      {
        code: "PARTIAL_PARSE" as const,
        message: "Local rules provider explained only the lines that matched its current rule set.",
      },
    ];
  }

  return [];
}

function countNonEmptyLines(code: string): number {
  return code.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function collectLineTokenIds(line: string): string[] {
  const tokenIds = new Set<string>();

  const keywordMatch = line.match(/^\s*(const|let|var|function|return)\b/);

  if (keywordMatch) {
    tokenIds.add(`keyword:${keywordMatch[1]}`);
  }

  const functionMatch = line.match(FUNCTION_NAME_PATTERN);

  if (functionMatch) {
    tokenIds.add(`function:${functionMatch[1]}`);
  }

  const hookStateMatch = line.match(
    /^\s*(?:const|let|var)\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*(useState|useReducer|useRef)\b/,
  );

  if (hookStateMatch) {
    tokenIds.add(`state:${hookStateMatch[1]}`);
    tokenIds.add(`setter:${hookStateMatch[2]}`);
  } else {
    const variableMatch = line.match(VARIABLE_NAME_PATTERN);

    if (variableMatch) {
      tokenIds.add(`variable:${variableMatch[1]}`);
    }
  }

  const hookMatch = line.match(HOOK_NAME_PATTERN);

  if (hookMatch) {
    tokenIds.add(`hook:${hookMatch[1]}`);
  }

  if (RETURN_PATTERN.test(line)) {
    tokenIds.add("operator:return");
  }

  if (ARROW_FUNCTION_PATTERN.test(line)) {
    tokenIds.add("operator:arrow-function");
  }

  const jsxMatch = line.match(JSX_TAG_NAME_PATTERN);

  if (jsxMatch) {
    tokenIds.add(`jsx:${jsxMatch[1]}`);
  }

  if (CLASS_NAME_PATTERN.test(line)) {
    tokenIds.add("jsx:className");
  }

  for (const utility of extractTailwindUtilities(line)) {
    tokenIds.add(`tailwind:${utility}`);
  }

  return [...tokenIds];
}

function buildTokens(code: string, lineExplanations: AgentLineExplanation[]): CodeToken[] {
  const tokens = new Map<string, CodeToken>();
  const lines = code.split(/\r?\n/);
  const explainedLines = new Set(lineExplanations.map((lineExplanation) => lineExplanation.line));

  for (const lineNumber of explainedLines) {
    const line = lines[lineNumber - 1] ?? "";

    registerKeywordToken(tokens, line, lineNumber);
    registerFunctionToken(tokens, line, lineNumber);
    registerVariableTokens(tokens, line, lineNumber);
    registerHookToken(tokens, line, lineNumber);
    registerReturnToken(tokens, line, lineNumber);
    registerArrowFunctionToken(tokens, line, lineNumber);
    registerJsxToken(tokens, line, lineNumber);
    registerClassNameToken(tokens, line, lineNumber);
    registerTailwindTokens(tokens, line, lineNumber);
  }

  return [...tokens.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function buildConceptOccurrences(
  lineExplanations: AgentLineExplanation[],
  tokens: CodeToken[],
): ConceptOccurrence[] {
  const occurrenceMap = new Map<
    string,
    {
      title: string;
      lines: Set<number>;
    }
  >();

  for (const lineExplanation of lineExplanations) {
    for (const conceptId of lineExplanation.conceptIds) {
      const occurrence = occurrenceMap.get(conceptId) ?? {
        title: humanizeConceptTitle(conceptId),
        lines: new Set<number>(),
      };

      occurrence.lines.add(lineExplanation.line);
      occurrenceMap.set(conceptId, occurrence);
    }
  }

  for (const token of tokens) {
    if (!token.conceptId) {
      continue;
    }

    const occurrence = occurrenceMap.get(token.conceptId) ?? {
      title: humanizeConceptTitle(token.conceptId),
      lines: new Set<number>(),
    };

    for (const line of token.lines) {
      occurrence.lines.add(line);
    }

    occurrenceMap.set(token.conceptId, occurrence);
  }

  return [...occurrenceMap.entries()]
    .map(([conceptId, occurrence]) => {
      const lines = [...occurrence.lines].sort((left, right) => left - right);

      return {
        conceptId,
        title: occurrence.title,
        lines,
        count: lines.length,
      };
    })
    .sort((left, right) => left.conceptId.localeCompare(right.conceptId));
}

function registerKeywordToken(tokens: Map<string, CodeToken>, line: string, lineNumber: number) {
  const keywordMatch = line.match(/^\s*(const|let|var|function|return)\b/);

  if (!keywordMatch) {
    return;
  }

  const keyword = keywordMatch[1];
  const labelMap: Record<string, string> = {
    const: "Const Keyword",
    let: "Let Keyword",
    var: "Var Keyword",
    function: "Function Keyword",
    return: "Return Keyword",
  };
  const descriptionMap: Record<string, string> = {
    const: "값을 다시 대입하지 않을 변수 선언을 시작하는 키워드다.",
    let: "값을 나중에 바꿀 수 있는 변수 선언을 시작하는 키워드다.",
    var: "오래된 방식의 변수 선언 키워드다.",
    function: "이름 있는 함수를 선언할 때 쓰는 키워드다.",
    return: "함수 바깥으로 결과를 돌려줄 때 쓰는 키워드다.",
  };

  upsertToken(tokens, {
    id: `keyword:${keyword}`,
    token: keyword,
    category: "keyword",
    label: labelMap[keyword],
    description: descriptionMap[keyword],
    lines: [lineNumber],
    conceptId: keyword === "return" ? "return" : undefined,
    bookmarkable: true,
  });
}

function registerFunctionToken(tokens: Map<string, CodeToken>, line: string, lineNumber: number) {
  const functionMatch = line.match(FUNCTION_NAME_PATTERN);

  if (!functionMatch) {
    return;
  }

  const functionName = functionMatch[1];

  upsertToken(tokens, {
    id: `function:${functionName}`,
    token: functionName,
    category: "function",
    label: "Function Name",
    description: "호출 가능한 로직 묶음의 이름이다.",
    example: `${functionName}()`,
    lines: [lineNumber],
    conceptId: "function",
    bookmarkable: true,
  });
}

function registerVariableTokens(tokens: Map<string, CodeToken>, line: string, lineNumber: number) {
  const hookStateMatch = line.match(
    /^\s*(?:const|let|var)\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*(useState|useReducer|useRef)\b/,
  );

  if (hookStateMatch) {
    const [, stateName, setterName] = hookStateMatch;

    upsertToken(tokens, {
      id: `state:${stateName}`,
      token: stateName,
      category: "state_variable",
      label: "State Variable",
      description: "화면이나 로직에서 계속 읽는 상태 값 이름이다.",
      lines: [lineNumber],
      conceptId: "state-or-reference",
      bookmarkable: true,
    });

    upsertToken(tokens, {
      id: `setter:${setterName}`,
      token: setterName,
      category: "state_setter",
      label: "State Setter",
      description: "상태 값을 바꾸기 위해 호출하는 setter 함수 이름이다.",
      lines: [lineNumber],
      conceptId: "state-or-reference",
      bookmarkable: true,
    });

    return;
  }

  const variableMatch = line.match(VARIABLE_NAME_PATTERN);

  if (!variableMatch) {
    return;
  }

  const variableName = variableMatch[1];

  upsertToken(tokens, {
    id: `variable:${variableName}`,
    token: variableName,
    category: "keyword",
    label: "Declared Variable",
    description: "이 줄에서 새로 선언된 변수 이름이다.",
    lines: [lineNumber],
    conceptId: "variable",
    bookmarkable: true,
  });
}

function registerHookToken(tokens: Map<string, CodeToken>, line: string, lineNumber: number) {
  const hookMatch = line.match(HOOK_NAME_PATTERN);

  if (!hookMatch) {
    return;
  }

  const hookName = hookMatch[1];

  upsertToken(tokens, {
    id: `hook:${hookName}`,
    token: hookName,
    category: "react_hook",
    label: "React Hook",
    description: "React가 상태나 생명주기 기능을 연결하도록 해주는 함수다.",
    example: `${hookName}(...)`,
    lines: [lineNumber],
    conceptId: "react-hook",
    bookmarkable: true,
  });
}

function registerReturnToken(tokens: Map<string, CodeToken>, line: string, lineNumber: number) {
  if (!RETURN_PATTERN.test(line)) {
    return;
  }

  upsertToken(tokens, {
    id: "operator:return",
    token: "return",
    category: "operator",
    label: "Return Statement",
    description: "함수 실행 결과를 바깥으로 돌려보내는 문장이다.",
    lines: [lineNumber],
    conceptId: "return",
    bookmarkable: true,
  });
}

function registerArrowFunctionToken(tokens: Map<string, CodeToken>, line: string, lineNumber: number) {
  if (!ARROW_FUNCTION_PATTERN.test(line)) {
    return;
  }

  upsertToken(tokens, {
    id: "operator:arrow-function",
    token: "=>",
    category: "operator",
    label: "Arrow Function Operator",
    description: "화살표 함수 문법을 시작하는 연산자다.",
    lines: [lineNumber],
    conceptId: "arrow-function",
    bookmarkable: true,
  });
}

function registerJsxToken(tokens: Map<string, CodeToken>, line: string, lineNumber: number) {
  const jsxMatch = line.match(JSX_TAG_NAME_PATTERN);

  if (!jsxMatch) {
    return;
  }

  const tagName = jsxMatch[1];

  upsertToken(tokens, {
    id: `jsx:${tagName}`,
    token: `<${tagName}>`,
    category: "jsx_element",
    label: "JSX Element",
    description: "화면에 렌더링될 요소 태그다.",
    example: `<${tagName}>...</${tagName}>`,
    lines: [lineNumber],
    conceptId: "jsx",
    bookmarkable: true,
  });
}

function registerClassNameToken(tokens: Map<string, CodeToken>, line: string, lineNumber: number) {
  if (!CLASS_NAME_PATTERN.test(line)) {
    return;
  }

  upsertToken(tokens, {
    id: "jsx:className",
    token: "className",
    category: "keyword",
    label: "className Prop",
    description: "JSX 요소에 스타일 클래스를 연결하는 속성 이름이다.",
    lines: [lineNumber],
    conceptId: "styling",
    bookmarkable: true,
  });
}

function registerTailwindTokens(tokens: Map<string, CodeToken>, line: string, lineNumber: number) {
  for (const utility of extractTailwindUtilities(line)) {
    upsertToken(tokens, {
      id: `tailwind:${utility}`,
      token: utility,
      category: classifyTailwindUtility(utility),
      label: "Tailwind Utility",
      description: "Tailwind CSS에서 미리 정의된 스타일 유틸리티 클래스다.",
      lines: [lineNumber],
      conceptId: "styling",
      bookmarkable: true,
    });
  }
}

function extractTailwindUtilities(line: string): string[] {
  const chunks: string[] = [];
  const directValue = line.match(CLASS_NAME_DIRECT_VALUE_PATTERN)?.slice(1).find(Boolean);

  if (directValue) {
    chunks.push(directValue);
  }

  const expressionValue = line.match(CLASS_NAME_EXPRESSION_PATTERN)?.[1];

  if (expressionValue) {
    for (const match of expressionValue.matchAll(/"([^"]+)"|'([^']+)'|`([^`]+)`/g)) {
      const value = match[1] ?? match[2] ?? match[3];

      if (value) {
        chunks.push(value);
      }
    }
  }

  return chunks.flatMap((chunk) => chunk.match(TAILWIND_UTILITY_PATTERN) ?? []);
}

function classifyTailwindUtility(utility: string): TokenCategory {
  if (/^(flex|grid|items-|justify-|w-|h-)/.test(utility)) {
    return "tailwind_layout";
  }

  if (/^(p|m)[trblxy]?-\d/.test(utility) || /^gap-\d/.test(utility)) {
    return "tailwind_spacing";
  }

  if (/^(bg-|text-)/.test(utility)) {
    return "tailwind_color";
  }

  if (/^(sm:|md:|lg:|xl:)/.test(utility)) {
    return "tailwind_responsive";
  }

  return "tailwind_utility";
}

function upsertToken(tokens: Map<string, CodeToken>, token: CodeToken) {
  const existing = tokens.get(token.id);

  if (!existing) {
    tokens.set(token.id, token);
    return;
  }

  const mergedLines = [...new Set([...existing.lines, ...token.lines])].sort((left, right) => left - right);

  tokens.set(token.id, {
    ...existing,
    lines: mergedLines,
  });
}

function humanizeConceptTitle(conceptId: string): string {
  const titleMap: Record<string, string> = {
    "arrow-function": "Arrow Function",
    function: "Function",
    jsx: "JSX",
    "jsx-rendering": "JSX Rendering",
    "react-hook": "React Hook",
    return: "Return",
    "state-or-reference": "State or Reference",
    styling: "Styling",
    "ui-structure": "UI Structure",
    variable: "Variable",
  };

  return titleMap[conceptId] ?? conceptId;
}
