// 부모 Claude Code 세션 런타임 env 제거(#981, #979 후속).
// Mustard를 claude 세션 안에서 띄우면(dev `open -n`) 세션 표식이 main→데몬·서버·SNA로 상속돼
// 자식 claude가 CHILD_SESSION으로 트랜스크립트 저장을 끄고 MESSAGING_SOCKET/TOKEN까지 샌다.
// 런타임 표식만 지운다 — CLAUDE_CONFIG_DIR·CLAUDE_CODE_USE_BEDROCK 같은 유저 설정은 유지
// (SNA는 셸 rc를 다시 읽지 않아서 전체 CLAUDE_* 삭제 시 유저 설정이 사라짐).
const RUNTIME_KEYS = [
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_EXECPATH",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_SESSION_ATTENDED",
  "CLAUDE_CODE_SESSION_ACCESS_TOKEN",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_MESSAGING_SOCKET",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "CLAUDE_PID",
  "CLAUDE_EFFORT",
  "CLAUDE_PLUGIN_DATA",
];

// claude 세션 안에서 실행됐을 때(CLAUDECODE 존재)만 정리. 일반 실행(Dock/Finder)은 no-op.
function stripParentClaudeEnv(env) {
  if (!env.CLAUDECODE) return;
  for (const k of RUNTIME_KEYS) delete env[k];
}

module.exports = { stripParentClaudeEnv };
