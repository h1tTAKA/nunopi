// incremental.ts self-check — 앱 미import. 실행: node --experimental-strip-types src/lib/repo/incremental.check.ts
import assert from "node:assert";
import { reconcile, type FileCache } from "./incremental.ts";

// 첫 분석: 캐시 비어 전부 재파싱.
let calls: string[] = [];
const extract = (rel: string) => { calls.push(rel); return [`spec:${rel}`]; };

const files1 = [
  { rel: "a.ts", mtimeMs: 100 },
  { rel: "b.ts", mtimeMs: 200 },
  { rel: "c.ts", mtimeMs: 300 },
];
const r1 = reconcile(new Map() as FileCache, files1, extract);
assert.strictEqual(r1.reparsed, 3, "첫 분석 전부 재파싱");
assert.deepStrictEqual(calls.sort(), ["a.ts", "b.ts", "c.ts"], "extract 3회");

// 재분석: b만 변경(mtime↑), a·c 그대로 → b만 재파싱.
calls = [];
const files2 = [
  { rel: "a.ts", mtimeMs: 100 },
  { rel: "b.ts", mtimeMs: 250 },  // 변경
  { rel: "c.ts", mtimeMs: 300 },
];
const r2 = reconcile(r1.cache, files2, extract);
assert.strictEqual(r2.reparsed, 1, "변경된 1개만 재파싱");
assert.deepStrictEqual(calls, ["b.ts"], "extract는 b만");
assert.strictEqual(r2.cache.get("a.ts"), r1.cache.get("a.ts"), "a 엔트리 재사용(동일 참조)");

// 삭제 + 신규: c 사라지고 d 추가.
calls = [];
const files3 = [
  { rel: "a.ts", mtimeMs: 100 },
  { rel: "b.ts", mtimeMs: 250 },
  { rel: "d.ts", mtimeMs: 400 },  // 신규
];
const r3 = reconcile(r2.cache, files3, extract);
assert.strictEqual(r3.reparsed, 1, "신규 1개만 재파싱");
assert.deepStrictEqual(calls, ["d.ts"], "extract는 d만");
assert.strictEqual(r3.cache.has("c.ts"), false, "삭제 파일 드롭");
assert.strictEqual(r3.cache.size, 3, "현재 목록 기준 3개");

console.log("incremental.check OK");
