// 레포 파일 스캐너 — 서버(Node) 전용. 폴더를 훑어 지원 소스 파일 경로를 모은다.
// 무시 디렉터리 제외 + 파일 수 상한(폭주 방지). import 파싱은 graph.ts에서.
import { readdirSync, type Dirent } from "node:fs";
import { join, relative, sep } from "node:path";

// 파싱 대상 확장자(TS/JS 우선 — 멀티랭은 후속).
const SUPPORTED = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
// 훑지 않을 디렉터리(빌드 산출물·의존성·VCS).
const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", "coverage",
  ".turbo", ".vercel", ".cache", "graphify-out", ".idea", ".vscode",
]);
// 파일 수 상한 — 초대형 레포 방어(후속 최적화 전까지).
export const MAX_FILES = 3000;

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

export interface ScanResult {
  root: string;
  files: string[];   // 레포 루트 기준 상대경로(POSIX 구분자 "/")
  capped: boolean;   // 상한에 걸려 잘렸으면 true
}

// root 아래 지원 파일을 재귀 수집. IGNORE_DIRS·숨김폴더 제외, MAX_FILES 상한.
export function scanRepo(root: string): ScanResult {
  const files: string[] = [];
  let capped = false;

  const walk = (dir: string) => {
    if (capped) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // 권한 등 — 그 폴더만 건너뜀
    }
    for (const e of entries) {
      if (capped) return;
      const name = e.name;
      const full = join(dir, name);
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(name) || name.startsWith(".")) continue; // 숨김·무시 폴더 스킵
        walk(full);
      } else if (e.isFile() && SUPPORTED.has(ext(name))) {
        files.push(relative(root, full).split(sep).join("/"));
        if (files.length >= MAX_FILES) { capped = true; return; }
      }
    }
  };
  walk(root);
  return { root, files, capped };
}
