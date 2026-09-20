// 네이티브 에이전트 챗(에픽 #916 Phase 1) — claude를 headless stream-json으로 실행하고
// 파싱된 JSON 프레임을 렌더러로 흘린다. 터미널 대신 SDK query()를 써서, diff·권한을 나중에
// 자체 React UI로 렌더할 수 있게 하는 백엔드 토대(터미널 claude가 자기 theme으로 diff를
// truecolor로 찍는 문제를 근본 회피 — orca 방식).
//
// SDK(@anthropic-ai/claude-agent-sdk)는 ESM(sdk.mjs)이고 임포트 시 process.env를 변형하므로
// CJS 정적 그래프에서 빼고 lazy dynamic import 후 프로세스당 1회 메모이즈한다(orca와 동일).

let sdkPromise = null;
function loadSdk() {
  return (sdkPromise ||= import("@anthropic-ai/claude-agent-sdk"));
}

// 유저 메시지 async iterable 큐 — SDK query({prompt})에 넘겨 턴을 스트리밍한다.
// push로 유저 턴 추가, end로 스트림 종료(제너레이터 완료 → SDK 정리).
function createInbox() {
  const q = [];
  let wake = null;
  let done = false;
  const iter = (async function* () {
    while (true) {
      if (q.length > 0) { yield q.shift(); continue; }
      if (done) return;
      await new Promise((r) => (wake = r));
    }
  })();
  const bump = () => { if (wake) { const w = wake; wake = null; w(); } };
  return {
    iter,
    push(msg) { q.push(msg); bump(); },
    end() { done = true; bump(); },
  };
}

const sessions = new Map(); // sessionId → { inbox, session }
const creating = new Set(); // 생성 중(sessions.set은 await 뒤라, 동기 예약으로 동일 id 경합 방지)

// claudePath가 실제 경로(/포함)면 SDK에 넘기고, 맨 이름("claude")이면 SDK 자체 resolve에 맡긴다.
function createSession({ sessionId, cwd, claudePath, model }, onFrame, onExit) {
  if (sessions.has(sessionId) || creating.has(sessionId)) return Promise.resolve({ ok: true, already: true });
  creating.add(sessionId); // 동기 예약(loadSdk await 전에)
  return loadSdk().then(({ query }) => {
    const inbox = createInbox();
    const options = {
      cwd,
      includePartialMessages: true,
      systemPrompt: { type: "preset", preset: "claude_code" },
      settingSources: ["user", "project", "local"],
      extraArgs: { "replay-user-messages": null },
    };
    if (model) options.model = model;
    if (claudePath && claudePath.includes("/")) options.pathToClaudeCodeExecutable = claudePath;
    let session;
    try {
      session = query({ prompt: inbox.iter, options });
    } catch (e) {
      creating.delete(sessionId);
      return { ok: false, reason: String((e && e.message) || e) };
    }
    sessions.set(sessionId, { inbox, session });
    creating.delete(sessionId);
    // stdout 프레임 소비 → 렌더러 전달. 종료/에러 시 세션 정리 + onExit.
    // onFrame/onExit(=broadcast)은 자체 try/catch(window별)라 안 던지지만, 콜백 예외가 unhandled로
    // 새지 않게 방어적으로 감싼다.
    (async () => {
      try {
        for await (const frame of session) { try { onFrame(sessionId, frame); } catch { /* ignore */ } }
      } catch (e) {
        try { onFrame(sessionId, { type: "_error", error: String((e && e.message) || e) }); } catch { /* ignore */ }
      } finally {
        sessions.delete(sessionId);
        try { onExit(sessionId); } catch { /* ignore */ }
      }
    })();
    return { ok: true };
  }).catch((e) => { creating.delete(sessionId); return { ok: false, reason: String((e && e.message) || e) }; });
}

function sendMessage(sessionId, text) {
  const s = sessions.get(sessionId);
  if (!s) return false;
  s.inbox.push({ type: "user", message: { role: "user", content: text } });
  return true;
}

function closeSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return;
  try { s.inbox.end(); } catch { /* ignore */ }
  try { s.session.return && s.session.return(); } catch { /* ignore */ } // 제너레이터 중단 → SDK 정리
  sessions.delete(sessionId);
}

module.exports = { createSession, sendMessage, closeSession };
