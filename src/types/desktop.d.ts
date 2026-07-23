// 일렉트론 preload가 노출하는 데스크톱 API(웹에선 undefined).
interface NunopiDesktopApi {
  isDesktop: true;
  getRuntimePaths(): Promise<{ claudeCode?: string; codex?: string; opencode?: string }>;
  setRuntimePaths(paths: { claudeCode?: string; codex?: string; opencode?: string }): Promise<{ ok: boolean; saved: Record<string, string> }>;
  relaunch(): Promise<void>;
  // 데스크톱 네이티브 알림. 창 포커스 중이면 스킵(reason:"focused").
  notify(payload: { title: string; body?: string }): Promise<{ ok: boolean; reason?: string }>;
}

interface Window {
  nunopiDesktop?: NunopiDesktopApi;
}
