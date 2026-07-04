// next build(output:standalone) 후 실행. standalone은 .next/static·public을
// 자동 포함하지 않으므로(Next 공식 동작) 수동 복사한다. (PoC서 필요 확인)
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(join(standalone, "server.js"))) {
  console.error("[copy-standalone] .next/standalone/server.js 없음 — 먼저 `next build`(output:standalone) 필요");
  process.exit(1);
}

cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
}
console.log("[copy-standalone] .next/static" + (existsSync(join(root, "public")) ? " + public" : "") + " → .next/standalone 복사 완료");
