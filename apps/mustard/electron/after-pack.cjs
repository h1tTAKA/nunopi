// electron-builder는 extraResources에서 node_modules를 설계상 제거한다.
// Next standalone 서버는 그 node_modules(next 등 트레이스본)가 있어야 돌아가므로,
// 패킹 직후 원본 .next/standalone/node_modules를 리소스로 그대로 복사한다.
const { cpSync, existsSync } = require("node:fs");
const { join } = require("node:path");

exports.default = async function afterPack(context) {
  // 현재 mac dir/dmg 타깃만 지원. Windows/Linux 추가 시(④/비범위) 리소스 경로 분기 필요.
  if (context.electronPlatformName !== "darwin") {
    console.warn("[after-pack] non-darwin 타깃 — standalone/node_modules 복사 로직 미지원(경로 분기 필요)");
    return;
  }
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

  // better-sqlite3를 패키지 앱 안에서 electron ABI로 재빌드(#684 ③). hoist 모노레포에선
  // electron-builder 기본 @electron/rebuild가 앱 사본이 아닌 워크스페이스 사본을 건드려,
  // 앱엔 시스템-node ABI(예: 127) 사본이 남아 SNA fork가 로드 실패(전자는 148 요구)한다.
  // 여기서 Resources/app/node_modules의 better-sqlite3를 명시적으로 electron 타깃 재빌드.
  const appDir = join(context.appOutDir, `${productName}.app`, "Contents", "Resources", "app");
  const electronVersion = context.packager.config.electronVersion
    || context.packager.info?.framework?.version
    || "43.7.0";
  try {
    const { rebuild } = require("@electron/rebuild");
    await rebuild({
      buildPath: appDir,
      electronVersion,
      arch: process.arch,
      force: true,
      onlyModules: ["better-sqlite3"],
    });
    console.log(`[after-pack] better-sqlite3 electron ABI 재빌드 완료(electron=${electronVersion}, arch=${process.arch})`);
  } catch (e) {
    console.error("[after-pack] better-sqlite3 재빌드 실패:", String(e?.message || e));
    throw e;
  }
};
