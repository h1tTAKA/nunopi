// JVM·Go import 해석 점검(#1023) — 실행: node --experimental-strip-types src/lib/repo/jvmGoImport.check.ts
import assert from "node:assert";
import { dirIndex, goModulePath, resolveGoImport, resolveJvmImport, GO_RE, JVM_RE } from "./imports.ts";

const files = [
  "gson/src/main/java/com/google/gson/Gson.java",
  "gson/src/main/java/com/google/gson/internal/Excluder.java",
  "gson/src/main/java/com/google/gson/internal/bind/TypeAdapters.kt",
  "app/src/main/kotlin/com/acme/util/Strings.kt",
  "README.md",
];
const jvm = dirIndex(files, JVM_RE);
assert.deepStrictEqual(resolveJvmImport("com/google/gson/internal/Excluder", jvm), ["gson/src/main/java/com/google/gson/internal/Excluder.java"], "소스 루트 무관 FQN");
assert.deepStrictEqual(resolveJvmImport("com/google/gson/internal/bind/TypeAdapters/STRING", jvm), ["gson/src/main/java/com/google/gson/internal/bind/TypeAdapters.kt"], "static import는 클래스로");
assert.deepStrictEqual(resolveJvmImport("com/google/gson/internal/", jvm), ["gson/src/main/java/com/google/gson/internal/Excluder.java"], "와일드카드 = 패키지 폴더");
assert.deepStrictEqual(resolveJvmImport("java/util/List", jvm), [], "외부(JDK)는 없음");
assert.deepStrictEqual(resolveJvmImport("google/gson/Gson", jvm), ["gson/src/main/java/com/google/gson/Gson.java"], "경로 꼬리 일치(부분 패키지)");

const go = ["main.go", "cmd/root.go", "cmd/version.go", "doc/man_docs.go", "doc/util.go", "doc/man_docs_test.go"];
const goDirs = dirIndex(go, GO_RE);
const mod = goModulePath("// c\nmodule github.com/spf13/cobra\n\ngo 1.21\n");
assert.strictEqual(mod, "github.com/spf13/cobra");
assert.deepStrictEqual(resolveGoImport("github.com/spf13/cobra/doc", mod, goDirs), ["doc/man_docs.go", "doc/util.go", "doc/man_docs_test.go"], "패키지 = 폴더 파일 전부");
assert.deepStrictEqual(resolveGoImport("github.com/spf13/cobra", mod, goDirs), ["main.go"], "모듈 루트 패키지");
assert.deepStrictEqual(resolveGoImport("github.com/spf13/pflag", mod, goDirs), [], "외부 모듈");
assert.deepStrictEqual(resolveGoImport("github.com/spf13/cobraX/a", mod, goDirs), [], "접두만 같은 다른 모듈 아님");
const two = dirIndex(["a/src/main/java/com/x/A.java", "a/src/test/java/com/x/ATest.java"], JVM_RE);
assert.deepStrictEqual(resolveJvmImport("com/x/ATest", two), ["a/src/test/java/com/x/ATest.java"], "같은 패키지가 main·test 두 루트에 있어도 찾음");
console.log("jvmGoImport.check OK");
