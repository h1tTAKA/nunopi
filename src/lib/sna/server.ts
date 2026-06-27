import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { resolveClaudeCli, startSnaServer, type SnaServerHandle } from "@sna-sdk/core/node";

// 에이전트 런타임 서버를 nunopi 서버 프로세스에서 1회 fork로 띄운다.
// dev HMR / 멀티워커가 모듈을 재평가해도 fork가 중복되지 않게 globalThis에 promise를 캐시.
const g = globalThis as unknown as { __snaServer?: Promise<SnaServerHandle> };

export function getSnaServer(): Promise<SnaServerHandle> {
  if (!g.__snaServer) g.__snaServer = boot();
  return g.__snaServer;
}

async function boot(): Promise<SnaServerHandle> {
  // 경로: env 우선(기존 detectClaudeAvailability와 동일 키), 없으면 SDK resolver.
  const explicit = process.env.NUNOPI_CLAUDE_COMMAND?.trim();
  const claudePath = explicit || resolveClaudeCli().path;

  const dbPath = process.env.NUNOPI_SNA_DB ?? "./.sna/nunopi.db";
  try { mkdirSync(dirname(dbPath), { recursive: true }); } catch { /* already exists */ }

  return startSnaServer({
    appId: "nunopi",
    port: Number(process.env.NUNOPI_SNA_PORT ?? 3099),
    dbPath,
    runtimePaths: { claudeCode: claudePath },
    onLog: (line) => { if (/ready|error|fail/i.test(line)) console.log("[sna]", line); },
  });
}
