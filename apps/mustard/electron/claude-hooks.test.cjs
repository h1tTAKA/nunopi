const assert = require("node:assert");
const { mergeHooks, parseVersion, MARKER } = require("./claude-hooks.cjs");

const EP = "/tmp/ep";
const ours = (s, ev) => (s.hooks[ev] || []).flatMap((g) => g.hooks).filter((h) => h.command.includes(MARKER));

// 기존 설정·다른 훅 보존 + 최신 버전이면 5개 이벤트
const user = { permissions: { allow: ["Bash(ls)"] }, hooks: { Stop: [{ hooks: [{ type: "command", command: "say done" }] }] } };
const a = mergeHooks(user, EP, "2.1.286");
assert.deepStrictEqual(a.permissions, user.permissions, "다른 키 보존");
assert.strictEqual(a.hooks.Stop[0].hooks[0].command, "say done", "유저 훅 보존");
for (const ev of ["UserPromptSubmit", "PostToolUse", "Stop", "PermissionRequest", "StopFailure"]) assert.strictEqual(ours(a, ev).length, 1, `${ev} 1개`);
assert.strictEqual(a.hooks.PostToolUse.at(-1).matcher, "", "PostToolUse matcher");

// 멱등 — 다시 돌려도 우리 훅 중복 안 생김
const b = mergeHooks(a, EP, "2.1.286");
assert.deepStrictEqual(b, a, "멱등");

// 버전 게이트 — 2.0.0엔 PermissionRequest·StopFailure 없음, 미확인(null)=1.0.64 → 3개만
const old = mergeHooks(a, EP, "2.0.0");
assert.strictEqual(ours(old, "PermissionRequest").length, 0, "2.0.0 PermissionRequest 제외");
assert.strictEqual(ours(old, "StopFailure").length, 0, "2.0.0 StopFailure 제외");
assert.ok(!old.hooks.PermissionRequest, "빈 이벤트 키 제거");
const unk = mergeHooks({}, EP, null);
assert.deepStrictEqual(Object.keys(unk.hooks).sort(), ["PostToolUse", "Stop", "UserPromptSubmit"], "미확인 버전 3개");

// 유저 원래 상태로 원복 가능(우리 것만 빠짐) — 버전 0.0.0이면 우리 훅 0개
const gone = mergeHooks(a, EP, "0.0.1");
assert.deepStrictEqual(gone.hooks, user.hooks, "우리 훅만 제거");

assert.strictEqual(parseVersion("2.1.286 (Claude Code)"), "2.1.286");
assert.strictEqual(parseVersion("garbage"), null);
console.log("claude-hooks ok");
