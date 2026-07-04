// electron-builder는 extraResources에서 node_modules를 설계상 제거한다.
// Next standalone 서버는 그 node_modules(next 등 트레이스본)가 있어야 돌아가므로,
// 패킹 직후 원본 .next/standalone/node_modules를 리소스로 그대로 복사한다.
const { cpSync, existsSync } = require("node:fs");
const { join } = require("node:path");

exports.default = async function afterPack(context) {
  const src = join(process.cwd(), ".next", "standalone", "node_modules");
  if (!existsSync(src)) throw new Error(`[after-pack] ${src} 없음 — electron:build 먼저`);
  const productName = context.packager.appInfo.productFilename; // "nunopi"
  // mac: <appOutDir>/<name>.app/Contents/Resources/standalone/node_modules
  const dst = join(
    context.appOutDir,
    `${productName}.app`,
    "Contents",
    "Resources",
    "standalone",
    "node_modules",
  );
  cpSync(src, dst, { recursive: true, dereference: true });
  console.log("[after-pack] standalone/node_modules → resources 복사 완료");
};
