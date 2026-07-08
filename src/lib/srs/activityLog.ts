// 복습 활동 로그 — 날짜별 채점 횟수. 현재 상태(SrsState)만으론 과거 복습 이력을 역산할 수 없어
// (날짜별 기록 미보존), 채점할 때마다 {yyyy-mm-dd: count}를 쌓는다. 히트맵/연속 스트릭용.
// 오늘부터 채워지며 과거 칸은 비어 있다(정상).

import { startOfLocalDay } from "./schedule";

const KEY = "nunopi:mem-activity";

type ActivityMap = Record<string, number>; // yyyy-mm-dd(로컬) -> 그날 채점 횟수

// 로컬 자정 기준 yyyy-mm-dd 키. UTC(toISOString)로 하면 자정 경계가 어긋나 스트릭이 깨진다.
export function dayKey(d: Date): string {
  const s = startOfLocalDay(d);
  const y = s.getFullYear();
  const m = String(s.getMonth() + 1).padStart(2, "0");
  const day = String(s.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function loadActivity(): ActivityMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActivityMap) : {};
  } catch {
    return {};
  }
}

// 채점 1회 = 오늘 카운트 +1.
export function logReview(now: Date): void {
  try {
    const map = loadActivity();
    const k = dayKey(now);
    map[k] = (map[k] ?? 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// 하루 전 날짜(로컬).
function addDays(d: Date, delta: number): Date {
  const base = startOfLocalDay(d);
  base.setDate(base.getDate() + delta);
  return base;
}

// 최근 weeks주 히트맵 — 오늘이 포함된 주의 토요일까지 채운 (weeks*7) 셀. 각 셀 {date, count}.
// 열=주, 행=요일(일~토)로 렌더하기 좋게 오래된→최신 순.
export function activityHeatmap(now: Date, weeks = 17): { date: string; count: number }[] {
  const map = loadActivity();
  const today = startOfLocalDay(now);
  // 이번 주 토요일(주 끝)로 정렬 — getDay: 0=일..6=토.
  const endOfWeek = addDays(today, 6 - today.getDay());
  const totalCells = weeks * 7;
  const start = addDays(endOfWeek, -(totalCells - 1));
  const cells: { date: string; count: number }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = addDays(start, i);
    const k = dayKey(d);
    cells.push({ date: k, count: map[k] ?? 0 });
  }
  return cells;
}

// 연속 복습 일수 — 오늘(또는 오늘 아직 안 했으면 어제)부터 뒤로 count>0이 이어진 날 수.
// 오늘 0이어도 어제까지 이어졌으면 그 길이 유지(오늘 아직 안 한 것뿐).
export function currentStreak(now: Date): number {
  const map = loadActivity();
  const today = startOfLocalDay(now);
  let cursor = today;
  // 오늘 안 했으면 어제부터 센다(오늘 미완료가 스트릭을 0으로 만들지 않게).
  if (!(map[dayKey(cursor)] > 0)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (map[dayKey(cursor)] > 0) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
