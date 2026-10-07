// 캐치업 날짜별 저장(#994, 에픽 #991) — 서버(Node) 전용. 레포별 폴더에 하루 1파일(jsonl) append.
// ~/.nunopi/stream/<sha(root)>/<YYYY-MM-DD>.jsonl(로컬 날짜). 코드그래프 캐시(~/.nunopi/codegraph)와 같은 루트.
// 레포 폴더엔 아무것도 안 남김. 하루 단위 파일이라 날짜 되돌아보기(캘린더)는 파일 하나만 읽으면 됨.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type CatchupKind = "symbol" | "file" | "query" | "repo" | "edit" | "narration";
export interface CatchupItem { key: string; kind: CatchupKind; target: string; tool: string; ts: number; expl: string }

const KINDS = new Set<CatchupKind>(["symbol", "file", "query", "repo", "edit", "narration"]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const normPath = (p: string) => p.replace(/\/+$/, "");
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
// 테스트에서 HOME 바꿔 쓰게 호출 시점 계산.
const baseDir = () => join(process.env.MUSTARD_STREAM_DIR || join(homedir(), ".nunopi", "stream"));
const repoDir = (root: string) => join(baseDir(), sha(normPath(root)));
// #998 캐치업 질문 에이전트가 읽을 기록 폴더(--add-dir).
export const streamDirFor = (root: string) => repoDir(root);

// 로컬 날짜 — 서버(standalone)는 같은 기기에서 앱이 띄우므로 화면(dayOf)과 시간대가 같다(#994 리뷰).
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 신뢰 경계(클라 POST) — 필드 타입·길이 검증. 잘못된 항목은 버림.
export function sanitize(x: unknown): CatchupItem | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.key !== "string" || !o.key || typeof o.target !== "string" || typeof o.expl !== "string" || !o.expl.trim()) return null;
  if (typeof o.ts !== "number" || !Number.isFinite(o.ts) || o.ts <= 0) return null;
  const kind = KINDS.has(o.kind as CatchupKind) ? (o.kind as CatchupKind) : null;
  if (!kind) return null;
  return { key: o.key.slice(0, 300), kind, target: o.target.slice(0, 300), tool: typeof o.tool === "string" ? o.tool.slice(0, 80) : "", ts: o.ts, expl: o.expl.slice(0, 8000) };
}

function readDayFile(file: string): CatchupItem[] {
  if (!existsSync(file)) return [];
  const out: CatchupItem[] = [];
  const keys = new Set<string>();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { const it = sanitize(JSON.parse(line)); if (it && !keys.has(it.key)) { keys.add(it.key); out.push(it); } } catch { /* 깨진 줄(쓰다 죽음) 스킵 */ }
  }
  return out;
}

// 같은 날 파일에 이미 있는 key는 스킵(이관·재전송 멱등). 날짜는 항목 ts 기준.
// 동시성(#994 리뷰): 읽기~append 사이에 await가 없는 동기 함수라 한 서버 프로세스 안에서 요청끼리 끼어들 수 없음.
// 혹시 생긴 중복(다중 프로세스 등)은 readDayFile이 key로 걸러냄.
// ponytail: append마다 그날 파일 전체를 읽음(하루 수백 건 수준 OK) — 커지면 파일별 key 캐시.
export function appendItems(root: string, items: CatchupItem[]): number {
  if (!root || !items.length) return 0;
  const dir = repoDir(root);
  mkdirSync(dir, { recursive: true });
  const rootFile = join(dir, "root.txt");
  if (!existsSync(rootFile)) writeFileSync(rootFile, normPath(root)); // 어느 레포 폴더인지(디버깅·정리용)
  const byDay = new Map<string, CatchupItem[]>();
  for (const it of items) { const d = dayKey(it.ts); byDay.set(d, [...(byDay.get(d) ?? []), it]); }
  let added = 0;
  for (const [day, list] of byDay) {
    const file = join(dir, `${day}.jsonl`);
    const seen = new Set(readDayFile(file).map((x) => x.key));
    const fresh = list.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
    if (!fresh.length) continue;
    appendFileSync(file, fresh.map((x) => JSON.stringify(x)).join("\n") + "\n");
    added += fresh.length;
  }
  return added;
}

// 기록 있는 날짜(최신 먼저) — 서브 C 캘린더용.
export function listDays(root: string): string[] {
  const dir = repoDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((f) => f.replace(/\.jsonl$/, "")).filter((d) => DAY_RE.test(d)).sort().reverse();
}

export function readDay(root: string, day: string): CatchupItem[] {
  if (!DAY_RE.test(day)) return [];
  return readDayFile(join(repoDir(root), `${day}.jsonl`)).sort((a, b) => b.ts - a.ts);
}

// 최근 limit개(최신 날짜 파일부터) — 패널 첫 로드.
export function readRecent(root: string, limit: number): CatchupItem[] {
  const out: CatchupItem[] = [];
  for (const day of listDays(root)) {
    out.push(...readDay(root, day));
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
