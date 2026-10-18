// ms 소요시간을 선택 언어로 짧게. 분석 경과/총 소요시간 표시용.
// <60초 → "12초"/"12秒"/"12s", ≥60초 → "2분 3초"/"2分3秒"/"2m 3s".
type DurLocale = "ko" | "ja" | "en";

const UNITS: Record<DurLocale, { min: string; sec: string; sep: string }> = {
  ko: { min: "분", sec: "초", sep: " " },
  ja: { min: "分", sec: "秒", sep: "" },
  en: { min: "m", sec: "s", sep: " " },
};

export function formatDuration(ms: number, locale: DurLocale = "ko"): string {
  const u = UNITS[locale] ?? UNITS.ko;
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}${u.sec}`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec === 0 ? `${min}${u.min}` : `${min}${u.min}${u.sep}${sec}${u.sec}`;
}
