// preload — renderer에 최소 데스크톱 API 노출(contextIsolation 유지).
// nunopi 스탠드얼론 학습앱(#894 서브5) — 워크스페이스 전용(github·terminal·ports·repo watch·provider-usage)은 없음.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nunopiDesktop", {
  isDesktop: true,
  getRuntimePaths: () => ipcRenderer.invoke("runtime-paths:get"),
  setRuntimePaths: (paths) => ipcRenderer.invoke("runtime-paths:set", paths),
  relaunch: () => ipcRenderer.invoke("app:relaunch"),
  notify: (payload) => ipcRenderer.invoke("notify", payload),
  // 클립보드 이미지를 임시 PNG로 저장하고 경로 반환(#799). 이미지 없으면 ok:false.
  saveClipboardImage: () => ipcRenderer.invoke("clipboard:save-image"),
  // 학습 모드를 별도 창으로 열기(#789) — 멀티모니터. {ok} 반환(exists면 ok:false).
  openModeWindow: (kind) => ipcRenderer.invoke("mode-window:open", kind),
  // 탭·창 통합 모드 중복 레지스트리(#789). claim 성공 시에만 탭 추가, 닫을 때 release.
  modeClaim: (kind) => ipcRenderer.invoke("mode:claim", kind),
  modeRelease: (kind) => ipcRenderer.invoke("mode:release", kind),
  modeIsOpen: (kind) => ipcRenderer.invoke("mode:isOpen", kind),
  listOpenModes: () => ipcRenderer.invoke("mode:list"),
  onModesChanged: (cb) => { const h = (_e, kinds) => cb(kinds); ipcRenderer.on("modes:changed", h); return () => ipcRenderer.removeListener("modes:changed", h); },
  // 창 전체화면 상태(#779) — 신호등 자리 좌측 패딩 토글용. 초기 상태 조회 + 변경 구독(해제 함수 반환).
  window: {
    isFullscreen: () => ipcRenderer.invoke("window:isFullscreen"),
    onFullscreen: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("window:fullscreen", h); return () => ipcRenderer.removeListener("window:fullscreen", h); },
  },
});
