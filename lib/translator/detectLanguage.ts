import type { SupportedLanguage } from "./types";

export interface DetectLanguageResult {
  primary: SupportedLanguage;
  secondary: SupportedLanguage[];
  confidence: number;
}

type ScoredLanguage = Exclude<SupportedLanguage, "unknown">;

interface SignalScore {
  react: number;
  typescript: number;
  javascript: number;
  css: number;
  tailwindcss: number;
}

const TAILWIND_UTILITY_PATTERN =
  /\b(?:flex|grid|items-center|justify-center|gap-\d+|p[trblxy]?-[\d.]+|m[trblxy]?-[\d.]+|bg-[\w-]+|text-[\w-]+|rounded(?:-[\w]+)?|w-\d+|h-\d+|sm:|md:|lg:|xl:|hover:|focus:|disabled:)\b/g;

const CSS_DECLARATION_PATTERN = /[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/m;

export function detectLanguage(code: string): DetectLanguageResult {
  const input = code.trim();

  if (!input) {
    return {
      primary: "unknown",
      secondary: [],
      confidence: 0,
    };
  }

  const score: SignalScore = {
    react: 0,
    typescript: 0,
    javascript: 0,
    css: 0,
    tailwindcss: 0,
  };

  const jsxTagCount = countMatches(input, /<\s*[A-Za-z][\w-]*(?:\s|>|\/)/g);
  const classNameCount = countMatches(input, /className\s*=\s*["'`]/g);
  const reactHookCount = countMatches(input, /\buse(?:State|Effect|Memo|Callback|Ref)\s*\(/g);

  if (jsxTagCount > 0) score.react += jsxTagCount * 3;
  if (classNameCount > 0) score.react += classNameCount * 2;
  if (reactHookCount > 0) score.react += reactHookCount * 4;

  const tsSignals =
    countMatches(input, /\binterface\s+[A-Z]\w*/g) +
    countMatches(input, /\btype\s+[A-Z]\w*\s*=\s*/g) +
    countMatches(input, /:\s*(?:string|number|boolean|unknown|any|void|never|\w+(?:\[\])?)/g) +
    countMatches(input, /<\s*[A-Z]\w*\s*>/g);

  if (tsSignals > 0) score.typescript += tsSignals * 2;

  const jsSignals =
    countMatches(input, /\b(?:const|let|var|function|return|if|else|for|while|async|await)\b/g) +
    countMatches(input, /=>/g) +
    countMatches(input, /\bfetch\s*\(/g);

  if (jsSignals > 0) score.javascript += jsSignals;

  const cssBlockCount = countMatches(input, CSS_DECLARATION_PATTERN);
  const cssPropertyCount = countMatches(input, /\b(?:display|position|color|background|padding|margin|border|gap|font-size)\s*:/g);
  const mediaCount = countMatches(input, /@media\s*\(/g);

  if (cssBlockCount > 0) score.css += cssBlockCount * 4;
  if (cssPropertyCount > 0) score.css += cssPropertyCount * 2;
  if (mediaCount > 0) score.css += mediaCount * 3;

  const tailwindSignals = extractTailwindSignals(input);
  if (tailwindSignals > 0) score.tailwindcss += tailwindSignals;

  // CSS 코드가 분명하면 JS 계열 가중치를 낮춰 오분류를 줄인다.
  if (score.css >= 6 && score.react === 0) {
    score.javascript = Math.max(0, score.javascript - 2);
    score.typescript = Math.max(0, score.typescript - 2);
  }

  const primary = pickPrimaryLanguage(score);
  const secondary = pickSecondaryLanguages(score, primary);

  const totalScore = Object.values(score).reduce((acc, value) => acc + value, 0);
  const topScore = primary === "unknown" ? 0 : score[primary];
  const confidence = totalScore > 0 ? clamp(topScore / totalScore, 0, 1) : 0;

  if (topScore === 0 || confidence < 0.25) {
    return {
      primary: "unknown",
      secondary: [],
      confidence,
    };
  }

  return {
    primary,
    secondary,
    confidence,
  };
}

function extractTailwindSignals(code: string): number {
  const classChunks = [
    ...matchAll(code, /className\s*=\s*"([^"]+)"/g),
    ...matchAll(code, /className\s*=\s*'([^']+)'/g),
    ...matchAll(code, /className\s*=\s*`([^`]+)`/g),
  ];

  let signalCount = 0;

  for (const chunk of classChunks) {
    signalCount += countMatches(chunk, TAILWIND_UTILITY_PATTERN);
  }

  return signalCount;
}

function pickPrimaryLanguage(score: SignalScore): SupportedLanguage {
  const ranking: ScoredLanguage[] = ["react", "typescript", "css", "javascript", "tailwindcss"];
  let current: ScoredLanguage = "javascript";

  for (const language of ranking) {
    if (score[language] > score[current]) {
      current = language;
    }
  }

  if (score[current] === 0) {
    return "unknown";
  }

  return current;
}

function pickSecondaryLanguages(score: SignalScore, primary: SupportedLanguage): SupportedLanguage[] {
  const threshold = 2;
  return (Object.keys(score) as ScoredLanguage[])
    .filter((language) => language !== primary)
    .filter((language) => score[language] >= threshold)
    .sort((a, b) => score[b] - score[a]);
}

function countMatches(input: string, regex: RegExp): number {
  const matches = input.match(regex);
  return matches ? matches.length : 0;
}

function matchAll(input: string, regex: RegExp): string[] {
  const chunks: string[] = [];

  for (const match of input.matchAll(regex)) {
    if (match[1]) {
      chunks.push(match[1]);
    }
  }

  return chunks;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
