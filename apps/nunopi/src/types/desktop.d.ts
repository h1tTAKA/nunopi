// 일렉트론 preload가 노출하는 데스크톱 API(웹에선 undefined).
// nunopi 스탠드얼론 학습앱(#894 서브5) — preload.cjs가 실제 노출하는 학습 표면만 선언.
// 워크스페이스 전용(github·terminal·ports·repo watch·provider-usage·pickRepoFolder)은 없음.
interface NunopiDesktopApi {
  isDesktop: true;
  getRuntimePaths(): Promise<{ claudeCode?: string; codex?: string; opencode?: string }>;
  setRuntimePaths(paths: { claudeCode?: string; codex?: string; opencode?: string }): Promise<{ ok: boolean; saved: Record<string, string> }>;
  relaunch(): Promise<void>;
  // 데스크톱 네이티브 알림. 창 포커스 중이면 스킵(reason:"focused").
  notify(payload: { title: string; body?: string }): Promise<{ ok: boolean; reason?: string }>;
  // 클립보드 이미지를 임시 PNG로 저장하고 경로 반환(#799). 이미지 없으면 ok:false.
  saveClipboardImage?(): Promise<{ ok: boolean; path?: string; error?: string }>;
  // 학습 모드를 별도 창으로 열기(#789) — 멀티모니터. ok:false(reason:"exists")면 이미 떠 있음.
  openModeWindow?(kind: "ask" | "code" | "text" | "memorize"): Promise<{ ok: boolean; reason?: string }>;
  // 탭·창 통합 모드 중복 레지스트리(#789). 탭 점유/해제/조회 + 변경 구독(해제 함수 반환).
  modeClaim?(kind: "ask" | "code" | "text" | "memorize"): Promise<{ ok: boolean }>;
  modeRelease?(kind: "ask" | "code" | "text" | "memorize"): Promise<{ ok: boolean }>;
  modeIsOpen?(kind: "ask" | "code" | "text" | "memorize"): Promise<boolean>;
  listOpenModes?(): Promise<Array<"ask" | "code" | "text" | "memorize">>;
  onModesChanged?(cb: (kinds: Array<"ask" | "code" | "text" | "memorize">) => void): () => void;
  // 창 전체화면 상태(#779) — 신호등 자리 좌측 패딩 토글용. onFullscreen은 해제 함수 반환.
  window?: {
    isFullscreen(): Promise<boolean>;
    onFullscreen(cb: (v: boolean) => void): () => void;
  };
}

interface Window {
  nunopiDesktop?: NunopiDesktopApi;
}
