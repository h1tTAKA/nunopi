const assert = require("node:assert");
const { mkdtempSync, writeFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { emptyState, seen, freshLines, CAP, HASH_CAP } = require("./narration-dedupe.cjs");
const { loadSeen, saveSeen } = require("./narration-seen-store.cjs");

const screen = "⏺ 서버 라우트 2개 완성, 클라이언트 호출 0건.\n  다음: 서버 부활 배선 — 클라에서 /api/revive 호출 추가\n> 1번 ㄱㄱ";
let st = seen(emptyState(), screen);

// #1019 resize 재그리기 — 다른 줄바꿈·들여쓰기 → 새 줄 없음
const repaint = "⏺ 서버 라우트 2개 완성,\n클라이언트 호출 0건.\n    다음: 서버 부활 배선 — 클라에서\n/api/revive 호출 추가\n> 1번 ㄱㄱ";
let r = freshLines(st, repaint);
assert.strictEqual(r.fresh, "", "재그리기는 새 내용 아님");

// 진짜 새 활동만
r = freshLines(r.state, repaint + "\n⏺ Edit(app/revive/page.tsx)\n  + await fetch('/api/revive')");
assert.strictEqual(r.fresh, "⏺ Edit(app/revive/page.tsx)\n  + await fetch('/api/revive')", "새 줄만 남김");
assert.strictEqual(freshLines(r.state, "⏺ Edit(app/revive/page.tsx)").fresh, "", "처리한 델타 재유입 차단");
assert.strictEqual(freshLines(emptyState(), "a\n\n  \nb").fresh, "a\nb", "빈 상태면 전부 새 것, 빈 줄 버림");

// 중복 시딩 무증식
const once = seen(emptyState(), screen);
assert.strictEqual(seen(once, screen), once, "같은 화면 두 번 시딩해도 그대로");

// #1031 말뭉치 꼬리에서 밀려난 오래된 줄도 해시로 기억 — resume이 같은 줄을 다시 찍으면 버림
let big = seen(emptyState(), "OLD-HISTORY-LINE-alpha 서버 부활 배선 설명");
for (let i = 0; i < 400; i++) big = seen(big, `filler line ${i} ${"x".repeat(1000)}`);
assert.ok(!big.corpus.includes("OLD-HISTORY-LINE-alpha"), "꼬리 상한으로 말뭉치에선 밀려남");
assert.strictEqual(freshLines(big, "OLD-HISTORY-LINE-alpha 서버 부활 배선 설명").fresh, "", "해시 집합으로 여전히 본 것");
assert.ok(big.corpus.length <= CAP && big.hashes.length <= HASH_CAP, "상한 지킴");

// 저장·불러오기 — 레포별 파일, 없음·손상이면 빈 상태
const dir = mkdtempSync(join(tmpdir(), "narr-seen-"));
assert.ok(saveSeen(dir, "/repo/a", r.state));
assert.deepStrictEqual(loadSeen(dir, "/repo/a"), r.state, "저장한 상태 그대로 복원");
assert.deepStrictEqual(loadSeen(dir, "/repo/b"), emptyState(), "다른 레포는 빈 상태");
assert.strictEqual(freshLines(loadSeen(dir, "/repo/a"), repaint).fresh, "", "재시작 후(파일에서 복원) 옛 화면도 본 것");
writeFileSync(join(dir, readdirSync(dir).find((f) => f.endsWith(".json"))), "{broken");
assert.deepStrictEqual(loadSeen(dir, "/repo/a"), emptyState(), "손상 파일 → 빈 상태(안 터짐)");
console.log("narration-dedupe ok");
