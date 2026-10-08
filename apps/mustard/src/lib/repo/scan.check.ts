// scan.ts self-check(#1003) — 실행: node --experimental-strip-types src/lib/repo/scan.check.ts
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanRepo, scanAllFiles } from "./scan.ts";

const root = mkdtempSync(join(tmpdir(), "scan-check-"));
const put = (rel: string, body = "x") => { const p = join(root, rel); mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, body); };
// Unity 프로젝트가 레포 하위(client/)에
put("client/Assets/Scripts/Player.cs", "class Player {}");
put("client/ProjectSettings/ProjectVersion.txt", "m_EditorVersion: 6000.0.0f1");
put("client/Library/PackageCache/com.unity.x/Engine.cs", "class Engine {}");
put("client/Temp/gen.cs", "class Gen {}");
put("client/Logs/a.cs", "class L {}");
// Unreal
put("unreal/Game.uproject", "{}");
put("unreal/Source/Game/Hero.cpp", "void f(){}");
put("unreal/Intermediate/Build/Gen.cpp", "void g(){}");
put("unreal/Binaries/x.cpp", "void h(){}");
// 엔진 아닌 곳의 Library는 진짜 코드 — 유지
put("web/Library/util.ts", "export const a = 1;");

const r = scanRepo(root);
const has = (p: string) => r.files.includes(p);
assert.ok(has("client/Assets/Scripts/Player.cs"), "Unity 스크립트 포함");
assert.ok(!r.files.some((f) => f.startsWith("client/Library/")), "Unity Library 제외");
assert.ok(!has("client/Temp/gen.cs") && !has("client/Logs/a.cs"), "Unity Temp·Logs 제외");
assert.ok(has("unreal/Source/Game/Hero.cpp"), "Unreal 소스 포함");
assert.ok(!has("unreal/Intermediate/Build/Gen.cpp") && !has("unreal/Binaries/x.cpp"), "Unreal 생성 폴더 제외");
assert.ok(has("web/Library/util.ts"), "엔진 아닌 Library는 유지");
assert.deepStrictEqual([...r.engines].sort(), ["unity", "unreal"], "엔진 감지");
const all = scanAllFiles(root);
assert.ok(!all.files.some((f) => f.startsWith("client/Library/")), "파일 트리도 Library 제외");
assert.ok(all.files.includes("client/ProjectSettings/ProjectVersion.txt"), "파일 트리는 ProjectSettings 유지");
// 대소문자 무시(리뷰) — 소문자 폴더명 Unity
put("lower/assets/a.cs", "class A {}"); put("lower/projectsettings/x.txt", "v"); put("lower/library/z.cs", "class Z {}");
const r2 = scanRepo(root);
assert.ok(r2.files.includes("lower/assets/a.cs") && !r2.files.includes("lower/library/z.cs"), "소문자 Unity 폴더도 감지·제외");
console.log("scan.check OK");
