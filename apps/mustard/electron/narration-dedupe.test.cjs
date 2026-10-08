const assert = require("node:assert");
const { seen, freshLines } = require("./narration-dedupe.cjs");

const screen = "⏺ 서버 라우트 2개 완성, 클라이언트 호출 0건.\n  다음: 서버 부활 배선 — 클라에서 /api/revive 호출 추가\n> 1번 ㄱㄱ";
let c = seen("", screen); // 앱이 세션을 처음 볼 때 현재 화면을 본 것으로

// resize 재그리기 — 같은 내용, 다른 줄바꿈·들여쓰기 → 새 줄 없음
const repaint = "⏺ 서버 라우트 2개 완성,\n클라이언트 호출 0건.\n    다음: 서버 부활 배선 — 클라에서\n/api/revive 호출 추가\n> 1번 ㄱㄱ";
let r = freshLines(c, repaint);
assert.strictEqual(r.fresh, "", "재그리기는 새 내용 아님");

// 진짜 새 활동만 남음
r = freshLines(r.corpus, repaint + "\n⏺ Edit(app/revive/page.tsx)\n  + await fetch('/api/revive')");
assert.strictEqual(r.fresh, "⏺ Edit(app/revive/page.tsx)\n  + await fetch('/api/revive')", "새 줄만 남김");

// 한 번 처리한 델타는 다음엔 본 것
assert.strictEqual(freshLines(r.corpus, "⏺ Edit(app/revive/page.tsx)").fresh, "", "처리한 델타 재유입 차단");

// 빈 말뭉치(시딩 전)면 전부 새 것, 빈 줄은 버림
assert.strictEqual(freshLines("", "a\n\n  \nb").fresh, "a\nb");

// 상한 — 아주 긴 입력도 꼬리만 유지
assert.ok(seen("", "x".repeat(400_000)).length <= 250_000, "말뭉치 상한");
// 같은 화면을 두 번 시딩(목록 루프 + 탭 붙이기)해도 말뭉치가 불어나지 않음(#1020 리뷰)
const once = seen("", screen);
assert.strictEqual(seen(once, screen), once, "중복 시딩 무증식");
console.log("narration-dedupe ok");
