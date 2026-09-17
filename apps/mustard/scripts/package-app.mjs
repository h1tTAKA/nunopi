// electron-builder 래퍼(#898, #684 OOM 해결).
//
// 문제: hoist 모노레포에서 electron-builder는 package.json dependencies를 자동 수집하며
// 루트 node_modules(1.2G)를 순회하다 OOM(fs.AfterStat 힙 폭주)한다. Next 서버 deps
// (next·react·monaco·shiki·tree-sitter·@mustard/* 등)는 이미 .next/standalone(extraResources)에
// 트랜스파일·번들돼 있어 asar에는 불필요하다. asar/메인 프로세스가 실제 필요한 건 네이티브·런타임 몇 개뿐.
//
// 해결: 패키징 동안만 package.json dependencies를 아래 allowlist로 줄여 electron-builder가
// 작은 closure만 순회하게 한 뒤, 끝나면 원본 그대로 복원(finally).
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// main.cjs가 require하거나(@sna-sdk/core/electron), SNA 포크 런타임/데몬이 로드하는 네이티브·런타임.
// 나머지(Next 서버용)는 standalone에 있음. 존재하는 것만 유지.
const KEEP = new Set(["@sna-sdk/core", "@sna-sdk/client", "better-sqlite3", "node-pty", "langfuse"]);

const pkgPath = "package.json";
const orig = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(orig);
const full = pkg.dependencies ?? {};
const minimal = {};
for (const [k, v] of Object.entries(full)) if (KEEP.has(k)) minimal[k] = v;
pkg.dependencies = minimal;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`[package-app] dependencies ${Object.keys(full).length} → ${Object.keys(minimal).length}개로 축소: ${Object.keys(minimal).join(", ")}`);

try {
  const r = spawnSync("electron-builder", process.argv.slice(2), { stdio: "inherit", shell: true });
  process.exitCode = r.status ?? 1;
} finally {
  writeFileSync(pkgPath, orig); // 원본 정확 복원(줄바꿈 포함)
  console.log("[package-app] package.json 원복 완료");
}
