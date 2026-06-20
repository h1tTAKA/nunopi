// ms 소요시간을 한국어로 짧게. 분석 경과/총 소요시간 표시용.
// <1초 → "0초", <60초 → "12초", ≥60초 → "2분 3초".
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}초`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec === 0 ? `${min}분` : `${min}분 ${sec}초`;
}
