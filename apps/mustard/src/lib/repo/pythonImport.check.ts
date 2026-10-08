// resolvePythonBare 점검(#1005) — 실행: node --experimental-strip-types src/lib/repo/pythonImport.check.ts
import assert from "node:assert";
import { resolvePythonBare } from "./imports.ts";

const files = new Set(["tools/_health_route.py", "tools/check-x.py", "tools/hooks/run.py", "pkg/__init__.py", "pkg/util.py", "app/main.py"]);
assert.strictEqual(resolvePythonBare("_health_route", "tools/check-x.py", files), "tools/_health_route.py", "같은 폴더 형제");
assert.strictEqual(resolvePythonBare("_health_route", "tools/hooks/run.py", files), "tools/_health_route.py", "상위 폴더");
assert.strictEqual(resolvePythonBare("pkg/util", "app/main.py", files), "pkg/util.py", "레포 루트 패키지 모듈");
assert.strictEqual(resolvePythonBare("pkg", "app/main.py", files), "pkg/__init__.py", "패키지 __init__");
assert.strictEqual(resolvePythonBare("os", "app/main.py", files), null, "표준 라이브러리 → null");
assert.strictEqual(resolvePythonBare("./x", "app/main.py", files), null, "상대는 여기서 안 함");
console.log("pythonImport.check OK");
