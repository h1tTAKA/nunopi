// next build(output:standalone) 후 실행. standalone은 .next/static·public을
// 자동 포함하지 않으므로(Next 공식 동작) 수동 복사한다. (PoC서 필요 확인)
// 또한 standalone 안의 심링크(예: .next/node_modules/shiki-<hash> → ../../node_modules/shiki)를
// 실복사로 materialize한다 — electron-builder 리소스 복사가 심링크에서 막히기 때문.
import { cpSync, existsSync, lstatSync, readlinkSync, rmSync, realpathSync, readdirSync } from "node:fs";
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

// 심링크 → 실복사(재귀 순회). electron-builder 패키징 호환.
let materialized = 0;
function deref(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) {
      const target = realpathSync(p); // 링크가 가리키는 실제 경로
      rmSync(p, { recursive: true, force: true });
      cpSync(target, p, { recursive: true, dereference: true });
      materialized++;
    } else if (st.isDirectory()) {
      deref(p);
    }
  }
}
deref(standalone);

console.log(`[copy-standalone] static${existsSync(join(root, "public")) ? " + public" : ""} 복사 + 심링크 ${materialized}개 materialize 완료`);
