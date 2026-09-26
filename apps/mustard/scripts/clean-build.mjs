// #975 빌드 전 클린 — 스테일 dist_electron/.next 제거.
// 재빌드 시 이전 dist_electron이 남아 있으면 next build의 NFT 트레이싱이 그것을 standalone에
// 통째로 넣어 .app 안에 .app이 재귀 중첩되고 codesign이 실패한다. 빌드 전에 지워 재발 차단.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const d of ["dist_electron", ".next"]) {
  try {
    rmSync(join(appDir, d), { recursive: true, force: true });
    console.log(`[clean-build] removed ${d}`);
  } catch (e) {
    console.warn(`[clean-build] skip ${d}: ${e?.message ?? e}`);
  }
}
