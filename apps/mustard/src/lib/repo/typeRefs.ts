// C# 타입 참조 → 정의 파일(#1005). C#은 `using`이 네임스페이스라 파일 import가 없고, 같은 네임스페이스 타입은
// using 없이 이름만 씀 → import 기반 그래프에서 C# 파일이 전부 섬(cooing 221/221). 본문에서 쓰인 타입 이름을
// 레포 전체 타입 인덱스(이름 → 정의 파일)와 맞춰 파일 간 references 엣지를 만든다. 순수 함수(import 없음, check 가능).
// ponytail: 정규식 근사(제네릭·using alias·partial class 다파일은 이름 매칭 수준). 정확 해석은 Roslyn급 — 범위 밖.

export interface TypeDef { name: string; file: string; namespace: string | null }

// 주석·문자열·문자 리터럴 제거 — 문자열 안 단어("Player")를 타입 참조로 오인하지 않게.
export function stripCsharp(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/@"(?:[^"]|"")*"/g, '""')
    .replace(/\$?"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])'/g, "''");
}

// 선언 네임스페이스(블록·파일 범위 `namespace X;` 첫 것) + using 네임스페이스들.
export function csharpNamespaces(text: string): { declared: string | null; usings: string[] } {
  const declared = /^\s*namespace\s+([\w.]+)/m.exec(text)?.[1] ?? null;
  const usings: string[] = [];
  const re = /^\s*using\s+(?!static\b)(?:\w+\s*=\s*)?([\w.]+)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) usings.push(m[1]);
  return { declared, usings };
}

// 엔진 API를 흉내 낸 스텁 파일(라이선스 없이 컴파일 검사용 등) — 진짜 엔진은 DLL이라 레포 밖. 스텁 타입을 인덱스에 넣으면
// MonoBehaviour·GameObject 쓰는 모든 스크립트가 스텁 한 파일로 몰림(#1005 cooing: 상속 39개 전부·calls 227개). 선언 ns 하나라도 엔진 ns면 스텁.
const ENGINE_NS = /^(UnityEngine|UnityEditor|Godot)(\.|$)/;
export function isEngineStub(text: string): boolean {
  for (const m of text.matchAll(/^\s*namespace\s+([\w.]+)/gm)) if (ENGINE_NS.test(m[1])) return true;
  return false;
}

const commonPrefixLen = (a: string, b: string) => { const x = a.split("/"), y = b.split("/"); let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };

// 같은 이름 타입이 여러 파일에 있으면: 보이는 네임스페이스(같은 ns·부모 ns·using) 우선 → 경로 공통 접두 긴 순 → 경로순.
function pick(file: string, defs: TypeDef[], ns: { declared: string | null; usings: string[] }): string {
  const visible = (d: TypeDef) => !d.namespace || d.namespace === ns.declared || ns.usings.includes(d.namespace)
    || (!!ns.declared && (ns.declared === d.namespace || ns.declared.startsWith(d.namespace + ".")));
  const pool = defs.filter(visible).length ? defs.filter(visible) : defs;
  return [...pool].sort((a, b) => commonPrefixLen(file, b.file) - commonPrefixLen(file, a.file) || a.file.localeCompare(b.file))[0].file;
}

// 이 파일이 참조하는 다른 파일들(중복 없음). index: 타입 이름 → 정의들.
export function csharpTypeRefs(file: string, text: string, index: Map<string, TypeDef[]>): string[] {
  const body = stripCsharp(text);
  const ns = csharpNamespaces(body);
  const out = new Set<string>();
  const seen = new Set<string>();
  for (const m of body.matchAll(/\b[A-Z][A-Za-z0-9_]*\b/g)) {
    const name = m[0];
    if (seen.has(name)) continue;
    seen.add(name);
    const defs = index.get(name)?.filter((d) => d.file !== file);
    if (!defs?.length) continue; // 레포에 없는 타입(Unity·BCL 등) 또는 자기 파일 정의
    out.add(pick(file, defs, ns));
  }
  return [...out];
}
