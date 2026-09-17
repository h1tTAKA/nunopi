// 일렉트론 셸 — nunopi 스탠드얼론 학습앱(Next 앱)을 데스크톱 창으로 감싼다.
// dev: ELECTRON_START_URL(예: http://localhost:3000) 로드(next dev 병행, HMR).
// prod: .next/standalone/server.js를 동적 포트로 spawn 후 그 localhost 로드.
// 워크스페이스(ADE) 전용(터미널·github·ports·repo watch)은 없음 — 학습 표면만(#894 서브5).
const { app, BrowserWindow, shell, ipcMain, Notification, clipboard } = require("electron");
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require("node:fs");
const {
  startSnaServer,
  resolveClaudeCli,
  resolveCodexCli,
  resolveOpenCodeCli,
} = require("@sna-sdk/core/electron");
const { spawn } = require("node:child_process");
const { join } = require("node:path");
const net = require("node:net");

// 빈 포트 하나 확보(패키지엔 devDep get-port가 없으므로 노드 net로 자체 구현).
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// 특정 포트가 비어 있는지 확인.
function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(true)));
  });
}

// Next 서버 포트는 origin(host:port)이 곧 IndexedDB/localStorage 저장소 키라
// 매 실행 같아야 이력·북마크가 유지된다. 첫 실행에 빈 포트를 잡아 userData에
// 영속하고 이후 재사용. (SNA 포트는 origin 무관이라 동적 유지.)
async function getStableAppPort() {
  const file = join(app.getPath("userData"), "app-port.json");
  try {
    const saved = JSON.parse(readFileSync(file, "utf8"))?.port;
    if (Number.isInteger(saved) && (await isPortFree(saved))) return saved;
    if (Number.isInteger(saved)) {
      console.warn(`[electron] saved app port ${saved} in use — reallocating (stored data origin will change)`);
    }
  } catch { /* 첫 실행 */ }
  const port = await getFreePort();
  try {
    mkdirSync(app.getPath("userData"), { recursive: true });
    writeFileSync(file, JSON.stringify({ port }));
  } catch (e) { console.warn("[electron] app-port persist failed:", String(e)); }
  return port;
}

const DEV_URL = process.env.ELECTRON_START_URL; // 있으면 dev 모드
let serverProc = null;
let snaHandle = null;
let win = null;
let appBase = null; // Next 서버 베이스 URL(boot서 설정) — 모드 전용 창(#789)이 참조.

// resolver 실패(미설치)를 삼켜 경로만 반환.
function safeResolve(fn) {
  try { const r = fn(); return r?.path; } catch { return undefined; }
}

// 유저가 설정 UI에서 지정한 런타임 CLI 경로 — userData/runtime-paths.json 영속.
// 부팅 시 saved > env(NUNOPI_*_COMMAND) > resolver 우선순위로 반영("재시작 후 적용").
const RUNTIME_PATH_KEYS = ["claudeCode", "codex", "opencode"]; // 학습앱은 gh(GitHub CLI) 불필요.
function runtimePathsFile() {
  return join(app.getPath("userData"), "runtime-paths.json");
}
function loadSavedRuntimePaths() {
  try {
    const raw = JSON.parse(readFileSync(runtimePathsFile(), "utf8"));
    const out = {};
    for (const k of RUNTIME_PATH_KEYS) {
      if (typeof raw?.[k] === "string" && raw[k].trim()) out[k] = raw[k].trim();
    }
    return out;
  } catch (e) {
    if (e?.code !== "ENOENT") console.warn("[runtime-paths] load failed:", String(e));
    return {};
  }
}
function saveRuntimePaths(paths) {
  const out = {};
  for (const k of RUNTIME_PATH_KEYS) {
    if (typeof paths?.[k] === "string" && paths[k].trim()) out[k] = paths[k].trim();
  }
  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(runtimePathsFile(), JSON.stringify(out, null, 2));
  return out;
}

// 런타임 서버를 electron main이 소유(전체 node_modules + asar/native 자동 처리).
// standalone Next는 이 서버에 env로 연결(자체 임베드는 트레이스 누락으로 불가).
async function startRuntimeServer() {
  const saved = loadSavedRuntimePaths();
  const runtimePaths = {
    claudeCode: saved.claudeCode || process.env.NUNOPI_CLAUDE_COMMAND?.trim() || safeResolve(resolveClaudeCli),
    codex: saved.codex || process.env.NUNOPI_CODEX_COMMAND?.trim() || safeResolve(resolveCodexCli),
    opencode: saved.opencode || process.env.NUNOPI_OPENCODE_COMMAND?.trim() || safeResolve(resolveOpenCodeCli),
  };
  for (const k of Object.keys(runtimePaths)) if (!runtimePaths[k]) delete runtimePaths[k];
  console.log("[sna] runtimePaths:", JSON.stringify(runtimePaths));
  return startSnaServer({
    appId: "nunopi",
    port: await getFreePort(),
    dbPath: join(app.getPath("userData"), "sna.db"),
    runtimePaths,
    onLog: (l) => { if (/ready|error|fail/i.test(l)) console.log("[sna]", l); },
  });
}

// standalone 서버 spawn(prod). extraEnv(런타임 커넥션)를 주입. 준비되면 baseUrl 반환.
async function startStandaloneServer(extraEnv) {
  const port = await getStableAppPort();
  // 모노레포 standalone은 앱별로 중첩 산출(#898): standalone/apps/nunopi/server.js.
  const serverJs = app.isPackaged
    ? join(process.resourcesPath, "standalone", "apps", "nunopi", "server.js")
    : join(__dirname, "..", ".next", "standalone", "apps", "nunopi", "server.js");
  serverProc = spawn(process.execPath, [serverJs], {
    env: {
      ...process.env,
      ...extraEnv,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      ELECTRON_RUN_AS_NODE: "1",
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

// 창 공통 배선 — 외부 링크 처리 + 전체화면 통지(#779). 메인 창·모드 전용 창(#789) 공유.
function wireWindowCommon(w) {
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  w.on("enter-full-screen", () => w.webContents.send("window:fullscreen", true));
  w.on("leave-full-screen", () => w.webContents.send("window:fullscreen", false));
}

function createWindow(url) {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 13 },
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(url);
  wireWindowCommon(win);
  // 메인 창 리로드/재네비게이트 시 stale "탭" 모드 점유 정리(#872). SPA 내부 라우팅엔 안 걸림.
  win.webContents.on("did-navigate", () => clearModeTabClaims());
  win.on("closed", () => { win = null; });
}

// 모드 전용 창(#789) — 그 모드만 보이는 별도 창. appBase에 ?win=<kind> 를 붙여 로드.
function createModeWindow(kind) {
  const sep = appBase.includes("?") ? "&" : "?";
  const w = new BrowserWindow({
    width: 1100,
    height: 820,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 13 },
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  w.loadURL(`${appBase}${sep}win=${encodeURIComponent(kind)}`);
  wireWindowCommon(w);
  return w;
}

// 크로스창 모드 중복 레지스트리(#789) — 한 모드(ask/code/text/memorize)는 탭으로든 창으로든 한 번만.
const openModes = new Map(); // kind -> "tab" | "window"
function broadcastModes() {
  const kinds = [...openModes.keys()];
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send("modes:changed", kinds); } catch { /* 창 파괴 중 무시 */ }
  }
}
function claimMode(kind, where) {
  if (openModes.has(kind)) return false;
  openModes.set(kind, where);
  broadcastModes();
  return true;
}
function releaseMode(kind) {
  if (openModes.delete(kind)) broadcastModes();
}
function clearModeTabClaims() {
  let changed = false;
  for (const [k, where] of openModes) if (where === "tab") { openModes.delete(k); changed = true; }
  if (changed) broadcastModes();
}

async function boot() {
  if (DEV_URL) {
    // dev: next dev가 자체 임베드(간섭 방지) → main은 SNA 안 띄움.
    appBase = DEV_URL;
    createWindow(DEV_URL);
    return;
  }
  // prod: main이 런타임 서버 소유 → 커넥션을 standalone Next에 env로 주입.
  snaHandle = await startRuntimeServer();
  const base = await startStandaloneServer({
    SNA_BASE_URL: snaHandle.connection.baseUrl,
    SNA_AUTH_TOKEN: snaHandle.connection.authToken,
  });
  appBase = base;
  createWindow(base);
}

// ── IPC (학습앱 범위) ──
ipcMain.handle("window:isFullscreen", () => win?.isFullScreen() ?? false); // 초기 전체화면 상태(#779)
// 클립보드 이미지 → 임시 PNG 저장(#799). 경로를 렌더러가 사용.
ipcMain.handle("clipboard:save-image", () => {
  try {
    const img = clipboard.readImage();
    if (img.isEmpty()) return { ok: false };
    const p = join(app.getPath("temp"), `nunopi-paste-${Date.now()}.png`);
    writeFileSync(p, img.toPNG());
    return { ok: true, path: p };
  } catch (e) { return { ok: false, error: String(e?.message || e) }; }
});
// 모드 전용 창 열기(#789) — 유효 kind + 아직 어디에도 안 떠 있을 때만. 창 닫히면 자동 해제.
ipcMain.handle("mode-window:open", (_e, kind) => {
  if (kind !== "ask" && kind !== "code" && kind !== "text" && kind !== "memorize") return { ok: false, reason: "invalid" };
  if (!appBase) return { ok: false, reason: "not-ready" };
  if (!claimMode(kind, "window")) return { ok: false, reason: "exists" };
  try {
    const w = createModeWindow(kind);
    w.on("closed", () => releaseMode(kind));
  } catch (e) {
    releaseMode(kind);
    return { ok: false, reason: "error", error: String(e?.message || e) };
  }
  return { ok: true };
});
// 탭 쪽 모드 점유/해제/조회(#789).
ipcMain.handle("mode:claim", (_e, kind) => ({ ok: claimMode(kind, "tab") }));
ipcMain.handle("mode:release", (_e, kind) => { releaseMode(kind); return { ok: true }; });
ipcMain.handle("mode:isOpen", (_e, kind) => openModes.has(kind));
ipcMain.handle("mode:list", () => [...openModes.keys()]);
ipcMain.handle("runtime-paths:get", () => loadSavedRuntimePaths());
ipcMain.handle("runtime-paths:set", (_e, paths) => ({ ok: true, saved: saveRuntimePaths(paths) }));
ipcMain.handle("app:relaunch", () => { app.relaunch(); app.quit(); });

// 알림 아이콘 경로 — dev=public, 패키지=standalone/public(존재하는 첫 후보).
function notifyIconPath() {
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, "standalone", "public", "brand", "nunopi-appicon-512.png"),
        join(process.resourcesPath, "public", "brand", "nunopi-appicon-512.png"),
      ]
    : [join(__dirname, "..", "public", "brand", "nunopi-appicon-512.png")];
  for (const c of candidates) { try { if (existsSync(c)) return c; } catch { /* ignore */ } }
  return undefined;
}

// 데스크톱 네이티브 알림(분석 완료 등). 창을 보고 있으면(포커스) 스킵 — 안 보고 있을 때만 알림.
ipcMain.handle("notify", (_e, payload) => {
  const { title, body } = payload ?? {};
  if (!Notification.isSupported()) return { ok: false, reason: "unsupported" };
  if (win && win.isFocused()) return { ok: false, reason: "focused" };
  const n = new Notification({ title: title || "nunopi", body: body || "", icon: notifyIconPath() });
  n.on("click", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  n.show();
  return { ok: true };
});

// 단일 인스턴스.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(boot).catch((e) => { console.error("[electron] boot failed", e); app.quit(); });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) boot(); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("before-quit", () => {
    try { serverProc?.kill(); } catch { /* ignore */ }
    try { snaHandle?.stop(); } catch { /* ignore */ }
  });
}
