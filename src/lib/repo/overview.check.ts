// overview.ts self-check — 앱 미import(번들 X). 실행: node --experimental-strip-types src/lib/repo/overview.check.ts
import assert from "node:assert";
import { repoOverview } from "./overview.ts";
import type { RepoGraph, RepoEdge } from "./types.ts";

// A(app) → B,C(components) → D(lib), E(lib) → D.  화살표 = imports.
// degree: D=4(in4), A=3(out3), B=2, C=2, E=1.  진입점(in0&out>0): A, E.
const edge = (source: string, target: string): RepoEdge => ({ source, target, relation: "imports" });
const g: RepoGraph = {
  root: "/x",
  nodes: [
    { id: "A", label: "A", file: "A", kind: "file", group: "app" },
    { id: "B", label: "B", file: "B", kind: "file", group: "components" },
    { id: "C", label: "C", file: "C", kind: "file", group: "components" },
    { id: "D", label: "D", file: "D", kind: "file", group: "lib" },
    { id: "E", label: "E", file: "E", kind: "file", group: "lib" },
  ],
  edges: [edge("A", "B"), edge("A", "C"), edge("A", "D"), edge("B", "D"), edge("C", "D"), edge("E", "D")],
  stats: { files: 5, edges: 6, scanned: 5, capped: false },
};

const o = repoOverview(g);
assert.strictEqual(o.godNodes[0].id, "D", "D가 최고 degree");
assert.strictEqual(o.godNodes[0].degree, 4, "D degree 4");
assert.strictEqual(o.godNodes[1].id, "A", "A가 2등");
const entryIds = o.entryPoints.map((e) => e.id).sort();
assert.deepStrictEqual(entryIds, ["A", "E"], "진입점 A·E (in0 & out>0)");
assert.strictEqual(o.groups[0].count, 2, "최다 그룹 2개(components 또는 lib)");
assert.strictEqual(o.groups.length, 3, "그룹 3개(app/components/lib)");

console.log("overview.check OK");
