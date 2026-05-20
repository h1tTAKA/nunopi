import type {
  AgentAnalyzeRequest,
  AgentAnalyzeResponse,
  AgentLineExplanation,
} from "./schema";
import type { AgentProvider } from "./types";

const HOOK_PATTERN = /\b(useState|useEffect|useMemo|useCallback|useRef)\s*\(/;
const JSX_PATTERN = /<\s*[A-Za-z][\w-]*(?:\s|>|\/)/;
const CLASS_NAME_PATTERN = /className\s*=/;
const FUNCTION_PATTERN = /^\s*function\s+[A-Za-z_$][\w$]*\s*\(/;
const VARIABLE_PATTERN = /^\s*(const|let|var)\s+/;
const RETURN_PATTERN = /^\s*return\b/;
const ARROW_FUNCTION_PATTERN = /=>/;

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
    const lineExplanations = buildLineExplanations(request.code);
    const matchedLineCount = lineExplanations.length;
    const totalNonEmptyLines = countNonEmptyLines(request.code);

    return {
      providerId: this.metadata.id,
      language: request.detectedLanguage ?? "unknown",
      summary: buildSummary(totalNonEmptyLines, matchedLineCount),
      lineExplanations,
      tokens: [],
      concepts: [],
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
      tokenIds: ["react-hook", "variable-declaration"],
      conceptIds: ["react-hook", "state-or-reference"],
      confidence: 0.96,
    };
  }

  if (HOOK_PATTERN.test(line)) {
    return {
      text: "React hook을 호출해서 상태, 효과, 메모이제이션 같은 React 기능을 연결하는 줄이다.",
      tokenIds: ["react-hook"],
      conceptIds: ["react-hook"],
      confidence: 0.94,
    };
  }

  if (FUNCTION_PATTERN.test(line)) {
    return {
      text: "이름이 있는 함수를 선언해서, 나중에 같은 로직을 여러 번 호출할 수 있게 만드는 줄이다.",
      tokenIds: ["function-declaration"],
      conceptIds: ["function"],
      confidence: 0.93,
    };
  }

  if (VARIABLE_PATTERN.test(line) && ARROW_FUNCTION_PATTERN.test(line)) {
    return {
      text: "변수에 화살표 함수를 저장해서, 나중에 함수처럼 호출할 수 있게 준비하는 줄이다.",
      tokenIds: ["variable-declaration", "arrow-function"],
      conceptIds: ["function", "arrow-function"],
      confidence: 0.91,
    };
  }

  if (VARIABLE_PATTERN.test(line)) {
    return {
      text: "값을 저장할 변수를 선언하는 줄이다. 이후 다른 줄에서 이 이름을 다시 사용하게 된다.",
      tokenIds: ["variable-declaration"],
      conceptIds: ["variable"],
      confidence: 0.88,
    };
  }

  if (RETURN_PATTERN.test(line) && JSX_PATTERN.test(line)) {
    return {
      text: "JSX 화면 조각을 return 해서, 이 컴포넌트가 실제로 어떤 UI를 그릴지 돌려주는 줄이다.",
      tokenIds: ["return", "jsx"],
      conceptIds: ["return", "jsx-rendering"],
      confidence: 0.96,
    };
  }

  if (RETURN_PATTERN.test(line)) {
    return {
      text: "함수 실행 결과를 바깥으로 돌려주는 return 줄이다.",
      tokenIds: ["return"],
      conceptIds: ["return"],
      confidence: 0.9,
    };
  }

  if (CLASS_NAME_PATTERN.test(line) && JSX_PATTERN.test(line)) {
    return {
      text: "JSX 요소에 className을 붙여서, 이 화면 조각의 스타일 규칙을 연결하는 줄이다.",
      tokenIds: ["jsx", "className"],
      conceptIds: ["jsx", "styling"],
      confidence: 0.9,
    };
  }

  if (JSX_PATTERN.test(line)) {
    return {
      text: "JSX 태그를 사용해서 화면에 렌더링될 요소 구조를 적는 줄이다.",
      tokenIds: ["jsx"],
      conceptIds: ["jsx", "ui-structure"],
      confidence: 0.87,
    };
  }

  if (ARROW_FUNCTION_PATTERN.test(line)) {
    return {
      text: "화살표 함수 문법을 사용해서 짧은 함수 로직을 표현하는 줄이다.",
      tokenIds: ["arrow-function"],
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
