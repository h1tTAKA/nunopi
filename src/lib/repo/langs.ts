// 언어 레지스트리 — 서버(Node) 전용. 확장자→언어 매핑 + 언어별 import 추출기.
// TS/JS는 TypeScript 컴파일러 API(정확), 나머지는 경량 정규식. 언어 추가 = LANGS에 항목 1개.
import ts from "typescript";

export interface LangDef {
  lang: string;                        // 표시용 이름
  exts: string[];                      // 담당 확장자(소문자, 점 포함)
  extract: (text: string) => string[]; // 소스 → raw import 지정자 목록(정규화된 형태 권장)
}

// TS/JS/TSX — 컴파일러 API가 import/require/dynamic import 다 잡음.
function extractTsJs(text: string): string[] {
  return ts.preProcessFile(text, true, true).importedFiles.map((i) => i.fileName);
}

// Python 모듈명(점 표기) → 해석용 지정자. 선행 점 = 상대 레벨.
//   "a.b.c" → "a/b/c" (절대)   ".mod" → "./mod"   "..pkg" → "../pkg"
function pyModuleToSpec(mod: string): string {
  const m = /^(\.*)(.*)$/.exec(mod)!;
  const dots = m[1].length;
  const rest = m[2].replace(/\./g, "/");
  if (dots === 0) return rest;
  return (dots === 1 ? "./" : "../".repeat(dots - 1)) + rest;
}

// Python — `import a.b`, `from a.b import c`, 상대 `from .mod import x`.
function extractPython(text: string): string[] {
  const specs: string[] = [];
  for (const line of text.split("\n")) {
    let m = /^\s*from\s+([.\w]+)\s+import\s+/.exec(line);
    if (m) { specs.push(pyModuleToSpec(m[1])); continue; }
    m = /^\s*import\s+(.+)$/.exec(line);
    if (m) {
      for (const part of m[1].split(",")) {
        const mod = part.trim().split(/\s+as\s+/)[0].trim();
        if (mod && /^[.\w]+$/.test(mod)) specs.push(pyModuleToSpec(mod));
      }
    }
  }
  return specs;
}

// Go — 단일 `import "x"` + 블록 `import ( "a" alias "b" )`. 지정자는 패키지 경로.
function extractGo(text: string): string[] {
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  const block = /import\s*\(([\s\S]*?)\)/g;
  while ((m = block.exec(text))) {
    for (const line of m[1].split("\n")) {
      const q = /"([^"]+)"/.exec(line);
      if (q) specs.push(q[1]);
    }
  }
  const single = /^\s*import\s+(?:[\w.]+\s+)?"([^"]+)"/gm;
  while ((m = single.exec(text))) specs.push(m[1]);
  return specs;
}

export const LANGS: LangDef[] = [
  { lang: "ts/js", exts: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"], extract: extractTsJs },
  { lang: "python", exts: [".py"], extract: extractPython },
  { lang: "go", exts: [".go"], extract: extractGo },
];

const EXT_TO_LANG = new Map<string, LangDef>();
for (const l of LANGS) for (const e of l.exts) EXT_TO_LANG.set(e, l);

// scan이 수집할 확장자 집합(레지스트리서 파생 — 단일 소스).
export const SUPPORTED_EXTS = new Set(EXT_TO_LANG.keys());

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

// 파일명 → 담당 LangDef(없으면 null).
export function detectLang(file: string): LangDef | null {
  return EXT_TO_LANG.get(extOf(file)) ?? null;
}
