// catchupStore 점검 — MUSTARD_STREAM_DIR=<임시> node --experimental-strip-types src/lib/catchupStore.check.ts
import assert from "node:assert";
import { appendItems, dayKey, listDays, readDay, readRecent, sanitize } from "./catchupStore.ts";

assert.ok(process.env.MUSTARD_STREAM_DIR, "임시 디렉터리 필수(실 기록 보호)");
const root = "/tmp/repo-a";
const d1 = new Date(2026, 9, 5, 10).getTime(), d2 = new Date(2026, 9, 6, 9).getTime();
const it = (key: string, ts: number) => ({ key, kind: "narration" as const, target: key, tool: "narration", ts, expl: `설명 ${key}` });

assert.strictEqual(dayKey(d1), "2026-10-05");
assert.strictEqual(appendItems(root, [it("a", d1), it("b", d2), it("c", d2 + 1000)]), 3, "3개 추가");
assert.strictEqual(appendItems(root + "/", [it("a", d1), it("c", d2 + 1000)]), 0, "같은 날 같은 key 스킵(멱등), 끝 슬래시 정규화");
assert.deepStrictEqual(listDays(root), ["2026-10-06", "2026-10-05"], "날짜 최신순");
assert.deepStrictEqual(readDay(root, "2026-10-06").map((x) => x.key), ["c", "b"], "하루 최신순");
assert.deepStrictEqual(readRecent(root, 2).map((x) => x.key), ["c", "b"], "최근 limit");
assert.deepStrictEqual(readRecent(root, 10).map((x) => x.key), ["c", "b", "a"], "여러 날 이어서");
assert.deepStrictEqual(readDay(root, "../etc"), [], "날짜 형식 아니면 빈 배열(경로 탈출 차단)");
assert.strictEqual(sanitize({ key: "x", kind: "evil", target: "t", ts: 1, expl: "e" }), null, "모르는 kind 거부");
assert.strictEqual(sanitize({ key: "x", kind: "file", target: "t", ts: 1, expl: "  " }), null, "빈 설명 거부");
assert.deepStrictEqual(listDays("/tmp/none"), [], "없는 레포");
console.log("catchupStore ok");
