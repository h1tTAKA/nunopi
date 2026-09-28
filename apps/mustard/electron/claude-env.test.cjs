const assert = require("node:assert");
const { stripParentClaudeEnv } = require("./claude-env.cjs");

// 일반 실행 — CLAUDECODE 없으면 아무것도 안 건드림
const plain = { CLAUDE_CODE_CHILD_SESSION: "1", CLAUDE_CONFIG_DIR: "/x", PATH: "/bin" };
stripParentClaudeEnv(plain);
assert.deepStrictEqual(plain, { CLAUDE_CODE_CHILD_SESSION: "1", CLAUDE_CONFIG_DIR: "/x", PATH: "/bin" });

// claude 세션 안 — 런타임 표식만 삭제, 유저 설정·기타 env 유지
const inside = {
  CLAUDECODE: "1", CLAUDE_CODE_CHILD_SESSION: "1", CLAUDE_CODE_MESSAGING_SOCKET: "/tmp/s.sock",
  CLAUDE_CODE_MESSAGING_TOKEN: "t", CLAUDE_CODE_SESSION_ID: "abc", CLAUDE_PID: "1",
  CLAUDE_CONFIG_DIR: "/x", CLAUDE_CODE_USE_BEDROCK: "1", PATH: "/bin",
};
stripParentClaudeEnv(inside);
assert.deepStrictEqual(inside, { CLAUDE_CONFIG_DIR: "/x", CLAUDE_CODE_USE_BEDROCK: "1", PATH: "/bin" });

console.log("claude-env ok");
