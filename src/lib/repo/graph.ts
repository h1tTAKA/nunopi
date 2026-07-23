// import 그래프 빌더 — 서버(Node) 전용. 스캔한 파일들의 import를 뽑아 파일 노드 + imports 엣지로.
// 파싱: TypeScript 컴파일러 API `ts.preProcessFile`(정확·의존성 0). 심볼레벨(calls)은 후속.
import { readFileSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { scanRepo } from "./scan";
import type { RepoGraph, RepoNode, RepoEdge } from "./types";

const RESOLVE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".d.ts"];

// tsconfig의 paths 별칭(@/* 등) + baseUrl 로드. 없으면 빈 별칭.
function loadAliases(root: string): { baseUrl: string; paths: Record<string, string[]> } {
  try {
    const read = ts.readConfigFile(join(root, "tsconfig.json"), ts.sys.readFile);
    const co = (read.config?.compilerOptions ?? {}) as { baseUrl?: string; paths?: Record<string, string[]> };
    const baseUrl = co.baseUrl ? resolve(root, co.baseUrl) : root;
    return { baseUrl, paths: co.paths ?? {} };
  } catch {
    return { baseUrl: root, paths: {} };
  }
}

// 레포 루트 기준 상대경로(POSIX)로 정규화.
function toRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

export function buildRepoGraph(root: string): RepoGraph {
  const { files, capped } = scanRepo(root);
  const fileSet = new Set(files);
  const { baseUrl, paths } = loadAliases(root);

  // 확장자 없는 절대경로 후보 → 실제 존재하는 레포 파일(rel) 반환. 없으면 null.
  const matchFile = (absNoExt: string): string | null => {
    const candidates: string[] = [];
    const rel0 = toRel(root, absNoExt);
    candidates.push(rel0); // 이미 확장자 포함일 수도
    for (const e of RESOLVE_EXTS) candidates.push(rel0 + e);
    for (const e of RESOLVE_EXTS) candidates.push(`${rel0}/index${e}`);
    for (const c of candidates) if (fileSet.has(c)) return c;
    return null;
  };

  // import 지정자 → 레포 파일(rel) 또는 null(외부·미해결).
  const resolveSpec = (spec: string, fromAbs: string): string | null => {
    if (spec.startsWith("./") || spec.startsWith("../")) {
      return matchFile(resolve(dirname(fromAbs), spec));
    }
    // tsconfig paths 별칭 매칭(예: "@/*": ["./src/*"]).
    for (const [pattern, targets] of Object.entries(paths)) {
      const star = pattern.indexOf("*");
      if (star < 0) {
        if (spec === pattern && targets[0]) {
          const hit = matchFile(resolve(baseUrl, targets[0].replace("*", "")));
          if (hit) return hit;
        }
        continue;
      }
      const prefix = pattern.slice(0, star);
      const suffix = pattern.slice(star + 1);
      if (spec.startsWith(prefix) && spec.endsWith(suffix)) {
        const mid = spec.slice(prefix.length, spec.length - suffix.length || undefined);
        for (const tgt of targets) {
          const hit = matchFile(resolve(baseUrl, tgt.replace("*", mid)));
          if (hit) return hit;
        }
      }
    }
    return null; // 외부 패키지 등
  };

  const nodes: RepoNode[] = files.map((f) => ({
    id: f,
    label: f.split("/").pop() ?? f,
    file: f,
    kind: "file",
    group: f.includes("/") ? f.split("/")[0] : "(root)",
  }));

  const edges: RepoEdge[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const abs = join(root, f);
    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const info = ts.preProcessFile(text, true, true);
    for (const imp of info.importedFiles) {
      const target = resolveSpec(imp.fileName, abs);
      if (!target || target === f) continue;
      const key = `${f}|${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: f, target, relation: "imports" });
    }
  }

  return {
    root,
    nodes,
    edges,
    stats: { files: nodes.length, edges: edges.length, scanned: files.length, capped },
  };
}
