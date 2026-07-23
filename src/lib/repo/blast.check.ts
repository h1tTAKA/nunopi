// blast.ts self-check — 앱에서 import 안 함(번들 X). 실행: npx tsx src/lib/repo/blast.check.ts
import assert from "node:assert";
import { blastRadius } from "./blast.ts";
import type { RepoGraph } from "./types.ts";

// A→B→C→D 사슬 + E→C (E도 C를 씀).  화살표 = imports.
// C를 바꾸면: 직접 의존자 B·E(거리1), 전이 A(거리2). D는 C가 쓰는 쪽이라 영향 없음.
const g: RepoGraph = {
  root: "/x",
  nodes: ["A", "B", "C", "D", "E"].map((id) => ({ id, label: id, file: id, kind: "file" })),
  edges: [
    { source: "A", target: "B", relation: "imports" },
    { source: "B", target: "C", relation: "imports" },
    { source: "C", target: "D", relation: "imports" },
    { source: "E", target: "C", relation: "imports" },
  ],
  stats: { files: 5, edges: 4, scanned: 5, capped: false },
};

const d = blastRadius(g, "C");
assert.strictEqual(d.get("C"), 0, "자기 자신 거리 0");
assert.strictEqual(d.get("B"), 1, "B는 C 직접 의존자");
assert.strictEqual(d.get("E"), 1, "E는 C 직접 의존자");
assert.strictEqual(d.get("A"), 2, "A는 전이 의존자");
assert.strictEqual(d.has("D"), false, "D는 C가 쓰는 쪽 = 영향 없음");
assert.strictEqual(d.size, 4, "C,B,E,A만");

console.log("blast.check OK");
