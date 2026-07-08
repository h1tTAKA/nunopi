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

// (레거시) 최근 weeks주 히트맵 — #405에서 yearActivity로 대체 예정.
export function activityHeatmap(now: Date, weeks = 17): { date: string; count: number }[] {
  const map = loadActivity();
  const today = startOfLocalDay(now);
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

export interface HeatCell {
  date: string | null; // 해당 연도 밖(그리드 패딩)이면 null
  count: number;
}

// 특정 연도의 깃헙 잔디식 매트릭스 — 주(열) × 요일(행, 일~토). 1/1이 든 주의 일요일부터
// 12/31이 든 주의 토요일까지. 연도 밖 칸은 date=null. months: 월이 바뀌는 주 인덱스+월(0~11).
export function yearActivity(year: number): { weeks: HeatCell[][]; months: { week: number; month: number }[] } {
  const map = loadActivity();
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const start = addDays(jan1, -jan1.getDay()); // 1/1이 든 주의 일요일
  const end = addDays(dec31, 6 - dec31.getDay()); // 12/31이 든 주의 토요일
  const weeks: HeatCell[][] = [];
  let week: HeatCell[] = [];
  for (let cur = start; cur.getTime() <= end.getTime(); cur = addDays(cur, 1)) {
    const inYear = cur.getFullYear() === year;
    const k = dayKey(cur);
    week.push({ date: inYear ? k : null, count: inYear ? map[k] ?? 0 : 0 });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  const months: { week: number; month: number }[] = [];
  let prev = -1;
  weeks.forEach((w, wi) => {
    const first = w.find((c) => c.date);
    if (!first || !first.date) return;
    const mo = Number(first.date.slice(5, 7)) - 1;
    if (mo !== prev) { months.push({ week: wi, month: mo }); prev = mo; }
  });
  return { weeks, months };
}

// 연도 네비 범위 — 데이터 있는 가장 이른 해 ~ 올해.
export function activityYearRange(now: Date): { min: number; max: number } {
  const map = loadActivity();
  const max = startOfLocalDay(now).getFullYear();
  let min = max;
  for (const k of Object.keys(map)) {
    const y = Number(k.slice(0, 4));
    if (Number.isFinite(y) && y < min) min = y;
  }
  return { min, max };
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
