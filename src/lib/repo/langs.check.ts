// langs.ts self-check — 앱 미import(번들 X). 실행: node --experimental-strip-types src/lib/repo/langs.check.ts
import assert from "node:assert";
import { detectLang, SUPPORTED_EXTS, LANGS } from "./langs.ts";

// 확장자 → 언어 매핑.
assert.ok(SUPPORTED_EXTS.has(".ts"), ".ts 지원");
assert.ok(SUPPORTED_EXTS.has(".tsx"), ".tsx 지원");
assert.strictEqual(detectLang("a/b/foo.tsx")?.lang, "ts/js", "tsx → ts/js");
assert.strictEqual(detectLang("x.unknownext"), null, "미지원 확장자 → null");

// TS/JS 추출기 — import/require/dynamic import 다 잡음.
const tsjs = LANGS.find((l) => l.lang === "ts/js")!;
const specs = tsjs.extract(`
import a from "./a";
import { b } from "../b";
const c = require("./c");
const d = import("./d");
import x from "react";
`);
assert.ok(specs.includes("./a"), "정적 import");
assert.ok(specs.includes("../b"), "named import");
assert.ok(specs.includes("./c"), "require");
assert.ok(specs.includes("./d"), "dynamic import");
assert.ok(specs.includes("react"), "외부 패키지도 지정자로(해석서 드롭)");

console.log("langs.check OK");
