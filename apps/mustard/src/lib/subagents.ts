// #977 서브에이전트 트리 — Claude Code 트랜스크립트(~/.claude/projects)서 세션의 서브에이전트 목록 추출.
// 메인 jsonl은 GB 단위라 tail만 읽는다. 서버(API route) 전용(node fs).
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface SubagentInfo { id: string; agentType: string; description: string; depth: number; running: boolean; startedAt: number; updatedAt: number }

const RECENT_DONE_MS = 10 * 60 * 1000; // 종료 후 이 시간까지만 표시
const STALE_MS = 5 * 60 * 1000;        // 미완료인데 이만큼 갱신 없으면 중단(스테일)으로 간주
const MAX_ITEMS = 20;

// Claude Code 프로젝트 폴더명 — cwd의 영숫자 외 문자를 "-"로(예: /Users/a/b c → -Users-a-b-c).
export const projectDirFor = (cwd: string) => join(homedir(), ".claude", "projects", cwd.replace(/\/+$/, "").replace(/[^a-zA-Z0-9]/g, "-"));

// tail 텍스트서 마지막 ai-title(세션 제목). 없으면 "".
export function lastAiTitle(tail: string): string {
  const lines = tail.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l.includes('"ai-title"')) continue;
    try { const d = JSON.parse(l); if (d.type === "ai-title" && typeof d.aiTitle === "string") return d.aiTitle; } catch { /* 잘린 첫 줄 등 */ }
  }
  return "";
}

// 서브 jsonl 마지막 레코드가 assistant + end_turn이면 완료.
export function isDone(lastLine: string): boolean {
  try { const d = JSON.parse(lastLine); return d.type === "assistant" && d.message?.stop_reason === "end_turn"; } catch { return false; }
}

async function readTail(path: string, bytes: number): Promise<string> {
  const fh = await fs.open(path, "r");
  try {
    const { size } = await fh.stat();
    const len = Math.min(size, bytes);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, size - len);
    return buf.toString("utf8");
  } finally { await fh.close(); }
}

// 세션 선택 — 최근 24h 수정된 jsonl 중 ai-title == title, 없으면 최신.
async function pickSession(dir: string, title: string): Promise<string | null> {
  let names: string[];
  try { names = (await fs.readdir(dir)).filter((n) => n.endsWith(".jsonl")); } catch { return null; }
  const now = Date.now();
  const cands = (await Promise.all(names.map(async (n) => {
    try { const st = await fs.stat(join(dir, n)); return { n, m: st.mtimeMs }; } catch { return null; }
  }))).filter((x): x is { n: string; m: number } => !!x && now - x.m < 24 * 3600 * 1000).sort((a, b) => b.m - a.m);
  const want = title.trim();
  if (!cands.length || !want) return null;
  for (const c of cands) {
    try {
      const t = lastAiTitle(await readTail(join(dir, c.n), 256 * 1024)).trim();
      // 정확 또는 접두 일치(OSC 타이틀이 잘렸을 수 있음). 최신 폴백은 안 함 — 같은 cwd 다른 세션 서브를 잘못 보여주는 것보다 안 보여주는 게 낫다(리뷰 🟡).
      if (t && (t === want || t.startsWith(want) || want.startsWith(t))) return c.n.slice(0, -6);
    } catch { /* skip */ }
  }
  return null;
}

export async function listSubagents(cwd: string, title: string): Promise<SubagentInfo[]> {
  const dir = projectDirFor(cwd);
  const sid = await pickSession(dir, title);
  if (!sid) return [];
  const sub = join(dir, sid, "subagents");
  let metas: string[];
  try { metas = (await fs.readdir(sub)).filter((n) => n.endsWith(".meta.json")); } catch { return []; }
  const now = Date.now();
  // ponytail: 서브 수천 개면 전부 stat(수 ms). 느려지면 mtime 인덱스 캐시.
  const out = (await Promise.all(metas.map(async (m): Promise<SubagentInfo | null> => {
    const id = m.slice(0, -".meta.json".length);
    const jl = join(sub, id + ".jsonl");
    try {
      const st = await fs.stat(jl);
      const age = now - st.mtimeMs;
      if (age > RECENT_DONE_MS) return null; // 오래된 건 읽기 전에 컷
      const last = (await readTail(jl, 64 * 1024)).trimEnd().split("\n").pop() ?? "";
      const meta = JSON.parse(await fs.readFile(join(sub, m), "utf8"));
      return {
        id: id.replace(/^agent-/, ""),
        agentType: String(meta.agentType ?? ""),
        description: String(meta.description ?? ""),
        depth: Number(meta.spawnDepth) || 1,
        running: !isDone(last) && age < STALE_MS,
        startedAt: st.birthtimeMs || st.mtimeMs,
        updatedAt: st.mtimeMs,
      };
    } catch { return null; }
  }))).filter((x): x is SubagentInfo => !!x);
  // ponytail: 부모 링크 대신 depth 들여쓰기 + 시작순. depth≥2 드묾 — 필요 시 toolUseId로 부모 jsonl 역추적.
  return out.sort((a, b) => a.startedAt - b.startedAt).slice(-MAX_ITEMS);
}
