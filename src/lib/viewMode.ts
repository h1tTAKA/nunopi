// 화면 전환 축 — 분석(코드/글)과 암기. AnalyzeMode("code"|"text"|…)는 분석 API
// 호출 성격이라 별개다. memorize는 분석을 안 하므로 뷰 축으로 분리해 분석 로직 오염을 막는다.
export type ViewMode = "code" | "text" | "memorize";

export const VIEW_MODE_KEY = "nunopi:view-mode";
