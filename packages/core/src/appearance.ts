"use client";

// 외관 적용 헬퍼(#937) — UI 줌·UI 폰트를 설정값으로 실제 적용.
// 줌은 electron webFrame(데스크톱 전용, 웹은 no-op). 폰트는 --font-sans 오버라이드.
import { getSetting, APKEYS, APPEARANCE_DEFAULTS, type UiFontPref } from "./settings";

// preload가 노출하는 최소 형태만 안다(패키지 경계 — apps 타입 미참조).
type DesktopZoom = { nunopiDesktop?: { setZoomFactor?: (factor: number) => void } };

// 프리셋별 폰트 스택. default=null → globals.css 원본(Inter+Noto) 유지.
const FONT_STACKS: Record<UiFontPref, string | null> = {
  default: null,
  system: 'system-ui, -apple-system, "Apple SD Gothic Neo", "Segoe UI", Roboto, sans-serif',
  mono: "var(--font-mono)",
};

export function applyUiZoom(factor: number) {
  if (typeof window === "undefined") return;
  const nd = (window as unknown as DesktopZoom).nunopiDesktop;
  nd?.setZoomFactor?.(factor);
}

export function applyUiFont(pref: UiFontPref) {
  if (typeof document === "undefined") return;
  const stack = FONT_STACKS[pref] ?? null;
  const root = document.documentElement;
  if (stack) root.style.setProperty("--font-sans", stack);
  else root.style.removeProperty("--font-sans"); // globals.css 원본으로 복귀
}

// 부팅 시 저장된 외관 복원(두 홈 마운트서 호출).
export function applyStoredAppearance() {
  applyUiZoom(getSetting<number>(APKEYS.uiZoom, APPEARANCE_DEFAULTS.uiZoom));
  applyUiFont(getSetting<UiFontPref>(APKEYS.uiFont, APPEARANCE_DEFAULTS.uiFont));
}
