// 일렉트론 셸 — nunopi(Next 앱)를 데스크톱 창으로 감싼다.
// dev: ELECTRON_START_URL(예: http://localhost:3000) 로드(next dev 병행, HMR).
// prod: .next/standalone/server.js를 동적 포트로 spawn 후 그 localhost 로드.
const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const { join } = require("node:path");

const DEV_URL = process.env.ELECTRON_START_URL; // 있으면 dev 모드
let serverProc = null;
let win = null;

// standalone 서버 spawn(prod). 준비되면 baseUrl 반환.
async function startStandaloneServer() {
  const getPort = (await import("get-port")).default;
  const port = await getPort();
  // main.cjs는 <appRoot>/electron/ 에 위치 → standalone은 <appRoot>/.next/standalone.
  // (패키징 시 리소스 경로 보정은 ③에서.)
  const serverJs = join(__dirname, "..", ".next", "standalone", "server.js");
  serverProc = spawn(process.execPath, [serverJs], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      ELECTRON_RUN_AS_NODE: "1", // electron 바이너리를 순수 node로 실행
    },
    stdio: "inherit",
  });
  serverProc.on("exit", (code) => { if (code) console.error("[electron] standalone server exited", code); });

  const base = `http://127.0.0.1:${port}`;
  await waitReady(`${base}/api/sna/status`);
  return base;
}

async function waitReady(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 503) return; // 503=SNA 미기동이어도 서버 자체는 살아있음
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server not ready: ${url}`);
}

function createWindow(url) {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(url);
  // 외부 링크는 기본 브라우저로.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => { win = null; });
}

async function boot() {
  const url = DEV_URL ?? (await startStandaloneServer());
  createWindow(url);
}

// 단일 인스턴스.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(boot).catch((e) => { console.error("[electron] boot failed", e); app.quit(); });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) boot(); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("before-quit", () => { try { serverProc?.kill(); } catch { /* ignore */ } });
}
