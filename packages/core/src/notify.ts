"use client";

// 데스크톱 알림 wrapper(#939) — 마스터 스위치 게이트 + silent 주입.
// 호출부는 window.nunopiDesktop.notify 대신 이걸 쓴다(테스트 버튼은 마스터 우회 위해 직접 호출 유지).
import { getSetting, NKEYS, NOTIF_DEFAULTS } from "./settings";

export type NotifyPayload = { title: string; body?: string; suppressWhileFocused?: boolean; silent?: boolean };
type NotifyResult = { ok: boolean; reason?: string };
type DesktopNotify = { nunopiDesktop?: { notify?: (p: NotifyPayload) => Promise<NotifyResult> } };

export async function desktopNotify(payload: NotifyPayload): Promise<NotifyResult> {
  // 마스터 꺼져 있으면 아예 안 보냄.
  if (!getSetting<boolean>(NKEYS.master, NOTIF_DEFAULTS.master)) return { ok: false, reason: "disabled" };
  if (typeof window === "undefined") return { ok: false, reason: "no-window" };
  const nd = (window as unknown as DesktopNotify).nunopiDesktop;
  if (!nd?.notify) return { ok: false, reason: "no-desktop" };
  // silent 미지정 시 설정값 사용.
  const silent = payload.silent ?? getSetting<boolean>(NKEYS.silent, NOTIF_DEFAULTS.silent);
  return nd.notify({ ...payload, silent });
}
