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

console.log("langs.check OK");
