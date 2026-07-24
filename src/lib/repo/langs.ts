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

export const LANGS: LangDef[] = [
  { lang: "ts/js", exts: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"], extract: extractTsJs },
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
