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

// Python — 절대/from/상대.
const py = LANGS.find((l) => l.lang === "python")!;
const pyspecs = py.extract(`
import os
import a.b.c
from a.b import thing
from .sibling import x
from ..pkg import y
import numpy as np
`);
assert.ok(pyspecs.includes("a/b/c"), "import a.b.c → a/b/c");
assert.ok(pyspecs.includes("a/b"), "from a.b import → a/b");
assert.ok(pyspecs.includes("./sibling"), "from .sibling → ./sibling");
assert.ok(pyspecs.includes("../pkg"), "from ..pkg → ../pkg");
assert.ok(pyspecs.includes("numpy"), "import numpy → numpy(외부, 해석서 드롭)");

// Go — 단일 + 블록.
const go = LANGS.find((l) => l.lang === "go")!;
const gospecs = go.extract(`
package main
import "fmt"
import (
  "strings"
  m "github.com/u/r/internal/db"
)
`);
assert.ok(gospecs.includes("fmt"), "단일 import");
assert.ok(gospecs.includes("strings"), "블록 import");
assert.ok(gospecs.includes("github.com/u/r/internal/db"), "블록 alias import");

// 확장자 매핑 신규 언어.
for (const e of [".java", ".kt", ".cs", ".rb", ".rs", ".php", ".c", ".hpp", ".swift"]) {
  assert.ok(SUPPORTED_EXTS.has(e), `${e} 지원`);
}

// Java — 세미콜론 + static.
const java = LANGS.find((l) => l.lang === "java")!;
const jspecs = java.extract(`import com.foo.Bar;\nimport static com.foo.Util.helper;`);
assert.ok(jspecs.includes("com/foo/Bar"), "java import → com/foo/Bar");
assert.ok(jspecs.includes("com/foo/Util/helper"), "java static import");

// Ruby — 상대/모듈.
const rb = LANGS.find((l) => l.lang === "ruby")!;
const rbspecs = rb.extract(`require_relative "lib/util"\nrequire "json"`);
assert.ok(rbspecs.includes("./lib/util"), "require_relative → ./lib/util");
assert.ok(rbspecs.includes("json"), "require → json(모듈)");

// Rust — mod + use.
const rs = LANGS.find((l) => l.lang === "rust")!;
const rsspecs = rs.extract(`mod parser;\npub mod db;\nuse crate::config::Settings;`);
assert.ok(rsspecs.includes("./parser"), "mod parser → ./parser");
assert.ok(rsspecs.includes("./db"), "pub mod db → ./db");
assert.ok(rsspecs.includes("config"), "use crate::config::Settings → config(아이템 제거)");

// PHP — include + use.
const php = LANGS.find((l) => l.lang === "php")!;
const phpspecs = php.extract(`require_once "lib/db.php";\nuse App\\Models\\User;`);
assert.ok(phpspecs.includes("./lib/db.php"), "require_once → ./lib/db.php");
assert.ok(phpspecs.includes("App/Models/User"), "use 백슬래시 → 슬래시");

// C — 로컬 include만.
const c = LANGS.find((l) => l.lang === "c/c++")!;
const cspecs = c.extract(`#include "util.h"\n#include <stdio.h>`);
assert.ok(cspecs.includes("./util.h"), '로컬 #include "util.h"');
assert.ok(!cspecs.some((s) => s.includes("stdio")), "시스템 <stdio.h> 스킵");

console.log("langs.check OK");
