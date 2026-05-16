import { detectLanguage } from "../../lib/translator/detectLanguage";
import type { SupportedLanguage } from "../../lib/translator/types";

interface DetectLanguageFixture {
  name: string;
  code: string;
  expectedPrimary: SupportedLanguage;
  expectedSecondary?: SupportedLanguage[];
}

const fixtures: DetectLanguageFixture[] = [
  {
    name: "react with useState",
    code: "const [count, setCount] = useState(0); return <div>{count}</div>;",
    expectedPrimary: "react",
  },
  {
    name: "react + tailwind className",
    code: `export function Card(){ return <div className=\"flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600\">ok</div>; }`,
    expectedPrimary: "react",
    expectedSecondary: ["tailwindcss"],
  },
  {
    name: "react + tailwind className in braces",
    code: "export function Card(){ return <div className={\"flex gap-2 md:grid bg-zinc-900\"}>ok</div>; }",
    expectedPrimary: "react",
    expectedSecondary: ["tailwindcss"],
  },
  {
    name: "typescript interface",
    code: "interface User { id: string; age: number } const user: User = { id: 'u1', age: 1 };",
    expectedPrimary: "typescript",
  },
  {
    name: "typescript generic",
    code: "type Box<T> = { value: T }; const b: Box<number> = { value: 1 };",
    expectedPrimary: "typescript",
  },
  {
    name: "plain javascript",
    code: "const items = [1,2,3]; const doubled = items.map((n) => n * 2);",
    expectedPrimary: "javascript",
  },
  {
    name: "plain javascript object literal should not be ts",
    code: "const user = { id: userId, name: fullName }; const next = { ...user, active: true };",
    expectedPrimary: "javascript",
  },
  {
    name: "javascript async fetch",
    code: "async function load(){ const res = await fetch('/api'); return res.json(); }",
    expectedPrimary: "javascript",
  },
  {
    name: "css block",
    code: ".card { display: flex; gap: 12px; color: #111; }",
    expectedPrimary: "css",
  },
  {
    name: "css media query",
    code: "@media (min-width: 768px) { .wrap { display: grid; gap: 8px; } }",
    expectedPrimary: "css",
  },
  {
    name: "tailwind string only",
    code: "className=\"md:flex lg:grid gap-4 text-sm bg-zinc-900\"",
    expectedPrimary: "tailwindcss",
    expectedSecondary: ["javascript"],
  },
  {
    name: "unknown text",
    code: "hello this is not code",
    expectedPrimary: "unknown",
  },
  {
    name: "empty input",
    code: "   ",
    expectedPrimary: "unknown",
  },
];

export function runDetectLanguageFixtures(): void {
  for (const fixture of fixtures) {
    const result = detectLanguage(fixture.code);

    if (result.primary !== fixture.expectedPrimary) {
      throw new Error(
        `[${fixture.name}] expected primary=${fixture.expectedPrimary}, actual=${result.primary}`,
      );
    }

    if (fixture.expectedSecondary && fixture.expectedSecondary.length > 0) {
      for (const expectedSecondary of fixture.expectedSecondary) {
        if (!result.secondary.includes(expectedSecondary)) {
          throw new Error(
            `[${fixture.name}] missing secondary=${expectedSecondary}; actual=${JSON.stringify(result.secondary)}`,
          );
        }
      }
    }
  }
}

if (process.env.RUN_TRANSLATOR_FIXTURES === "1") {
  runDetectLanguageFixtures();
  console.log("detectLanguage fixtures passed");
}
