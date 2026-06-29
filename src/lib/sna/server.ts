import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { resolveClaudeCli, resolveCodexCli, startSnaServer, type SnaServerHandle } from "@sna-sdk/core/node";

// 에이전트 런타임 서버를 nunopi 서버 프로세스에서 1회 fork로 띄운다.
// dev HMR / 멀티워커가 모듈을 재평가해도 fork가 중복되지 않게 globalThis에 promise를 캐시.
const g = globalThis as unknown as { __snaServer?: Promise<SnaServerHandle> };

export function getSnaServer(): Promise<SnaServerHandle> {
  if (!g.__snaServer) {
    // 부팅 실패 시 캐시를 비워 다음 호출에 재시도 가능하게(거부 promise 영구 캐시 방지).
    g.__snaServer = boot().catch((err) => {
      g.__snaServer = undefined;
      throw err;
    });
  }
  return g.__snaServer;
}

async function boot(): Promise<SnaServerHandle> {
  // 경로: env 우선(기존 detect*와 동일 키), 없으면 SDK resolver.
  const claudePath = process.env.NUNOPI_CLAUDE_COMMAND?.trim() || resolveClaudeCli().path;
  // codex는 미설치일 수 있으니 resolver 실패를 삼켜 claude만으로도 부팅되게 한다.
  let codexPath: string | undefined;
  try {
    codexPath = process.env.NUNOPI_CODEX_COMMAND?.trim() || resolveCodexCli().path;
  } catch { codexPath = process.env.NUNOPI_CODEX_COMMAND?.trim() || undefined; }

  const dbPath = process.env.NUNOPI_SNA_DB ?? "./.sna/nunopi.db";
  // recursive:true는 이미 존재해도 throw 안 함 → 실패(권한 등)는 그대로 올려 boot가 거부되게.
  mkdirSync(dirname(dbPath), { recursive: true });

  return startSnaServer({
    appId: "nunopi",
    port: Number(process.env.NUNOPI_SNA_PORT ?? 3099),
    dbPath,
    runtimePaths: { claudeCode: claudePath, ...(codexPath ? { codex: codexPath } : {}) },
    onLog: (line) => { if (/ready|error|fail/i.test(line)) console.log("[sna]", line); },
  });
}
