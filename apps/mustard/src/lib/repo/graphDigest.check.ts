// graphDigest 자체 점검 — node --experimental-strip-types src/lib/repo/graphDigest.check.ts
import assert from "node:assert";
import { graphDigest } from "./graphDigest.ts";
import type { RepoGraph } from "./types.ts";

const n = (id: string, file: string) => ({ id, label: file.split("/").pop()!, file, kind: "file" as const });
const g = {
  nodes: [
    n("src/a/x.ts", "src/a/x.ts"), n("src/a/y.ts", "src/a/y.ts"),
    n("src/b/z.ts", "src/b/z.ts"), n("lib/util.ts", "lib/util.ts"),
  ],
  edges: [
    { source: "src/a/x.ts", target: "lib/util.ts", relation: "imports" as const }, // x가 허브 util 씀
    { source: "src/a/y.ts", target: "lib/util.ts", relation: "imports" as const },
    { source: "src/b/z.ts", target: "lib/util.ts", relation: "imports" as const },
    { source: "src/a/x.ts", target: "src/a/y.ts", relation: "calls" as const },     // 같은 모듈 내
  ],
} as unknown as RepoGraph;

const out = graphDigest(g, { moduleDepth: 2 });
assert.ok(out.includes("[모듈 구조 — 실측 코드그래프]"), "모듈 구조 헤더");
assert.ok(out.includes("src/a (2 files)"), "src/a 2파일");
assert.ok(out.includes("lib (1 files)"), "lib 1파일");
assert.ok(out.includes("[모듈 의존(import)]"), "의존 헤더");
assert.ok(/src\/a → lib \(2\)/.test(out), "src/a→lib 2회 (x,y)"); // 모듈간만
assert.ok(!/src\/a → src\/a/.test(out), "같은 모듈 의존 없음");
assert.ok(out.includes("[핵심 허브 파일(연결 많음)]"), "허브 헤더");
assert.ok(/1\. lib\/util\.ts \(deg 3\)/.test(out), "util이 최상위 허브(deg 3)");

// --- 게임 구조(#1013) ---
const gnode = (id: string, role?: "scene" | "prefab" | "asset") => ({ id, label: id.split("/").pop()!, file: id, kind: "file" as const, ...(role ? { role } : {}) });
const game: RepoGraph = {
  root: "/g",
  nodes: [gnode("A/Main.unity", "scene"), gnode("A/Cat.prefab", "prefab"), gnode("A/Bal.asset", "asset"), gnode("A/P.cs"), gnode("A/Q.cs")],
  edges: [
    { source: "A/Main.unity", target: "A/P.cs", relation: "uses" }, { source: "A/Main.unity", target: "A/Q.cs", relation: "uses" },
    { source: "A/Main.unity", target: "A/Cat.prefab", relation: "instantiates" }, { source: "A/Main.unity", target: "A/Bal.asset", relation: "uses" },
    { source: "A/Cat.prefab", target: "A/P.cs", relation: "uses" },
  ],
};
const gout = graphDigest(game, { namesPerAsset: 1 });
assert.ok(gout.includes("[게임 구조"), "게임 구조 헤더");
assert.ok(gout.includes("A/Main.unity (scene) → 스크립트 2: P.cs (+1) · 배치 1: Cat.prefab · 에셋 1: Bal.asset"), "씬: 스크립트(상한+나머지)·배치·에셋");
assert.ok(gout.indexOf("A/Main.unity (scene)") < gout.indexOf("A/Cat.prefab (prefab) → 스크립트 1: P.cs"), "씬이 프리팹보다 먼저");
assert.ok(!out.includes("[게임 구조"), "게임 에셋 없는 레포엔 섹션 없음");

console.log("graphDigest.check OK\n---\n" + out);
