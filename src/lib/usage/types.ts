// Claude·Codex 구독 사용 한도 조회 결과(#735) — main의 provider-usage.cjs가 반환하는 형태.
export type UsageWindow = {
  usedPercent: number; // 0-100
  windowMinutes: number; // 300(5h) | 10080(7d) | 43200(30d)
  resetsAt: number | null; // unix ms
  resetLabel: string | null; // "2:30 PM" | "Thu 2:30 PM"
};

export type ProviderUsage = {
  provider: "claude" | "codex" | "grok";
  status: "ok" | "unavailable" | "error"; // unavailable=크레덴셜 없음(로그인 안 함), error=네트워크/서버
  session?: UsageWindow | null;
  weekly?: UsageWindow | null;
  monthly?: UsageWindow | null; // Grok 월간 예산 윈도우(43200분) — 크레딧% 없는 통합빌링 계정
  fableWeekly?: UsageWindow | null; // Claude 전용
  needsRefresh?: boolean; // Grok 전용 — 토큰 stale = "터미널서 grok 한번 돌려 갱신"(재로그인 아님)
  signedIn?: boolean;     // Grok 전용 — 로그인은 됐으나 노출할 한도 없음(무료 계정). "로그인 안 됨"과 구분
};

export type ProviderUsageResult = { claude: ProviderUsage; codex: ProviderUsage; grok: ProviderUsage };
