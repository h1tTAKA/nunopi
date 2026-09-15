// 복습 활동 로그 — 날짜별 채점 횟수. 현재 상태(SrsState)만으론 과거 복습 이력을 역산할 수 없어
// (날짜별 기록 미보존), 채점할 때마다 {yyyy-mm-dd: count}를 쌓는다. 히트맵/연속 스트릭용.
// 오늘부터 채워지며 과거 칸은 비어 있다(정상).

import { startOfLocalDay } from "./schedule";
import { loadTokenDetails, loadConceptDetails, loadTermDetails } from "@/lib/bookmarkDetails";
import type { Grade } from "./types";

const KEY = "nunopi:mem-activity";

// 그날 채점 로그 — n=총 채점 수(강도용), again/hard/good=등급별. 하위호환: 옛 데이터는 숫자였음.
export interface DayLog { n: number; again: number; hard: number; good: number }
type ActivityMap = Record<string, DayLog>;

// 로컬 자정 기준 yyyy-mm-dd 키. UTC(toISOString)로 하면 자정 경계가 어긋나 스트릭이 깨진다.
export function dayKey(d: Date): string {
  const s = startOfLocalDay(d);
  const y = s.getFullYear();
  const m = String(s.getMonth() + 1).padStart(2, "0");
  const day = String(s.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 옛 형식(숫자=총 채점 수)도 DayLog로 정규화. 등급 분해는 없으니 n만 채운다.
export function loadActivity(): ActivityMap {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number | DayLog>) : {};
    const out: ActivityMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") out[k] = { n: v, again: 0, hard: 0, good: 0 };
      else out[k] = { n: v.n ?? 0, again: v.again ?? 0, hard: v.hard ?? 0, good: v.good ?? 0 };
    }
    return out;
  } catch {
    return {};
  }
}

// 채점 1회 = 오늘 총 +1, 해당 등급 +1.
export function logReview(now: Date, grade: Grade): void {
  try {
    const map = loadActivity();
    const k = dayKey(now);
    const d = map[k] ?? { n: 0, again: 0, hard: 0, good: 0 };
    d.n += 1;
    d[grade] += 1;
    map[k] = d;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// 날짜별 신규 북마크(추가=미분류 신규) 수 — 3개 store의 bookmarkedAt 기준.
export function bookmarkedByDay(): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (iso?: string) => {
    if (!iso) return;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    const k = dayKey(d);
    out[k] = (out[k] ?? 0) + 1;
  };
  try {
    for (const t of Object.values(loadTokenDetails())) add(t.bookmarkedAt);
    for (const c of Object.values(loadConceptDetails())) add(c.bookmarkedAt);
    for (const t of Object.values(loadTermDetails())) add(t.bookmarkedAt);
  } catch { /* ignore */ }
  return out;
}

// 하루 전 날짜(로컬).
function addDays(d: Date, delta: number): Date {
  const base = startOfLocalDay(d);
  base.setDate(base.getDate() + delta);
  return base;
}

export interface HeatCell {
  date: string | null; // 해당 연도 밖(그리드 패딩)이면 null
  count: number; // 그날 총 채점 수(강도)
  again: number;
  hard: number;
  good: number;
  added: number; // 그날 신규 북마크(미분류 신규) 수
}

// 특정 연도의 깃헙 잔디식 매트릭스 — 주(열) × 요일(행, 일~토). 1/1이 든 주의 일요일부터
// 12/31이 든 주의 토요일까지. 연도 밖 칸은 date=null. months: 월이 바뀌는 주 인덱스+월(0~11).
export function yearActivity(year: number): { weeks: HeatCell[][]; months: { week: number; month: number }[] } {
  const map = loadActivity();
  const added = bookmarkedByDay();
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const start = addDays(jan1, -jan1.getDay()); // 1/1이 든 주의 일요일
  const end = addDays(dec31, 6 - dec31.getDay()); // 12/31이 든 주의 토요일
  const weeks: HeatCell[][] = [];
  let week: HeatCell[] = [];
  for (let cur = start; cur.getTime() <= end.getTime(); cur = addDays(cur, 1)) {
    const inYear = cur.getFullYear() === year;
    const k = dayKey(cur);
    const d = inYear ? map[k] : undefined;
    week.push({
      date: inYear ? k : null,
      count: d?.n ?? 0,
      again: d?.again ?? 0,
      hard: d?.hard ?? 0,
      good: d?.good ?? 0,
      added: inYear ? added[k] ?? 0 : 0,
    });
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
  const did = (d: Date) => (map[dayKey(d)]?.n ?? 0) > 0;
  // 오늘 안 했으면 어제부터 센다(오늘 미완료가 스트릭을 0으로 만들지 않게).
  if (!did(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (did(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
