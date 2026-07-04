// 최소 preload. nunopi는 localhost로 자족 동작하므로 현재 노출 API 없음.
// 추후 데스크톱 전용 기능(파일 저장 다이얼로그 등) 필요 시 contextBridge로 노출.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("nunopiDesktop", {
  isDesktop: true,
});
