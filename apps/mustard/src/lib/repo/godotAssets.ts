// Godot 구조(#1011, 에픽 #1002-3) — 씬(.tscn)·리소스(.tres)는 텍스트이고 스크립트·하위 씬을 res:// 경로로 직접 참조.
// GDScript(.gd)는 preload/load/extends로 의존. tree-sitter-wasms에 GDScript 문법이 없어 정규식(파일 단위 연결만).
// 순수 함수(import 없음, check 가능).

export interface GodotExtResource { type: string | null; path: string }

// [ext_resource type="Script" path="res://p.gd" id="1_a"] — Godot 3(id=1)·4(uid=, id="..") 모두, 속성 순서 무관.
export function godotExtResources(text: string): GodotExtResource[] {
  const out: GodotExtResource[] = [];
  for (const m of text.matchAll(/^\[ext_resource\s+([^\]\n]*)\]/gm)) {
    const attrs = new Map<string, string>();
    for (const a of m[1].matchAll(/(\w+)\s*=\s*(?:"([^"]*)"|([^\s\]]+))/g)) attrs.set(a[1], a[2] ?? a[3]);
    const path = attrs.get("path");
    if (path?.startsWith("res://")) out.push({ type: attrs.get("type") ?? null, path });
  }
  return out;
}

export interface GdscriptRefs { paths: string[]; className: string | null; extendsName: string | null }

// GDScript → res:// 의존 경로(preload·load·경로 extends), 자기 class_name, 이름 extends(엔진 클래스면 호출 측 인덱스에서 탈락).
export function gdscriptRefs(text: string): GdscriptRefs {
  const code = text.replace(/^\s*#.*$/gm, ""); // 줄 전체 주석 — 주석 처리된 preload 오인 방지
  const paths = new Set<string>();
  for (const m of code.matchAll(/\b(?:preload|load)\(\s*["'](res:\/\/[^"']+)["']/g)) paths.add(m[1]);
  const ext = /^\s*extends\s+(?:["'](res:\/\/[^"']+)["']|([A-Za-z_]\w*))/m.exec(code);
  if (ext?.[1]) paths.add(ext[1]);
  return {
    paths: [...paths],
    className: /^\s*class_name\s+([A-Za-z_]\w*)/m.exec(code)?.[1] ?? null,
    extendsName: ext?.[2] ?? null,
  };
}

// res://p → 레포 파일. res://는 "그 파일이 속한 Godot 프로젝트 루트" 기준 절대경로 — roots(project.godot 폴더들)를 알면
// 가장 깊은(가까운) 루트 + p만 본다(#1012 리뷰: 위로 올라가기는 game/levels/player.gd 같은 하위 동명 파일을 잘못 고름).
// roots를 모르면(외부 호출) 파일 폴더 → 상위 → 루트로 올라가며 첫 일치(근사).
export function resolveRes(resPath: string, fromFile: string, fileSet: Set<string>, roots?: string[]): string | null {
  const p = resPath.slice("res://".length).replace(/^\/+/, "");
  const own = roots?.filter((r) => r === "" || fromFile.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0];
  if (own !== undefined) { const cand = own ? `${own}/${p}` : p; return fileSet.has(cand) ? cand : null; }
  const parts = fromFile.split("/").slice(0, -1);
  for (let i = parts.length; i >= 0; i--) {
    const cand = [...parts.slice(0, i), p].join("/");
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

// 참조 대상 → 관계(Unity와 같은 뜻). 스크립트·리소스는 uses, 씬은 instantiates, 텍스처 등은 null.
export function godotRelation(target: string): "uses" | "instantiates" | null {
  const t = target.toLowerCase();
  if (t.endsWith(".gd") || t.endsWith(".cs") || t.endsWith(".tres") || t.endsWith(".res")) return "uses";
  if (t.endsWith(".tscn") || t.endsWith(".scn")) return "instantiates";
  return null;
}

export const GODOT_FILE_EXTS = [".gd", ".tscn", ".tres"] as const;
export const isGodotFile = (file: string) => GODOT_FILE_EXTS.some((e) => file.toLowerCase().endsWith(e));

export interface GodotEdge { source: string; target: string; relation: "imports" | "uses" | "instantiates" }

// Godot 파일 본문들 → 파일 간 엣지(중복 제거). graph.ts가 호출, check가 픽스처로 끝까지 검증.
// .tscn/.tres: ext_resource → uses/instantiates. .gd: preload·load·경로 extends → imports, extends ClassName → class_name 정의 파일 imports.
export function godotEdges(texts: Map<string, string>, fileSet: Set<string>, roots?: string[]): GodotEdge[] {
  const byClass = new Map<string, string>();
  const gd = new Map<string, GdscriptRefs>();
  for (const [file, text] of texts) {
    if (!file.toLowerCase().endsWith(".gd")) continue;
    const r = gdscriptRefs(text);
    gd.set(file, r);
    if (r.className && !byClass.has(r.className)) byClass.set(r.className, file);
  }
  const out: GodotEdge[] = [];
  const seen = new Set<string>();
  const add = (source: string, target: string | null | undefined, relation: GodotEdge["relation"] | null) => {
    if (!target || !relation || target === source) return;
    const k = `${source}|${target}|${relation}`;
    if (!seen.has(k)) { seen.add(k); out.push({ source, target, relation }); }
  };
  for (const [file, text] of texts) {
    const r = gd.get(file);
    if (r) {
      for (const p of r.paths) add(file, resolveRes(p, file, fileSet, roots), "imports");
      if (r.extendsName) add(file, byClass.get(r.extendsName), "imports"); // 엔진 클래스(Node2D 등)는 인덱스에 없어 탈락
    } else {
      for (const res of godotExtResources(text)) {
        const target = resolveRes(res.path, file, fileSet, roots);
        add(file, target, target ? godotRelation(target) : null);
      }
    }
  }
  return out;
}
