// gitBranches 점검(#1025) — 실행: node --experimental-strip-types src/lib/repo/gitBranches.check.ts
import assert from "node:assert";
import { isSafeRef, parseBranchList } from "./gitBranches.ts";

const out = [
  "refs/heads/main\t100",
  "refs/heads/feature/a\t300",
  "refs/heads/old\t50",
  "refs/remotes/origin/HEAD\t100",
  "refs/remotes/origin/main\t100",
  "refs/remotes/origin/feature/a\t300",
  "refs/remotes/origin/feature/b\t400",
  "refs/remotes/upstream/fix\t200",
  "",
].join("\n");
const r = parseBranchList(out);
assert.deepStrictEqual(r.local, ["feature/a", "main", "old"], "로컬 최근 커밋 순");
assert.deepStrictEqual(r.remote, ["origin/feature/b", "upstream/fix"], "원격 전용만(로컬 있는 것·HEAD 제외), 최근 순");
assert.deepStrictEqual(parseBranchList(""), { local: [], remote: [] });
assert.ok(isSafeRef("feature/1025-x") && isSafeRef("origin/main"));
assert.ok(!isSafeRef("-b") && !isSafeRef("a..b") && !isSafeRef("a b") && !isSafeRef("a;rm"), "옵션·범위·공백·특수문자 차단");
console.log("gitBranches.check OK");
