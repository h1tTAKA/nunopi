import { existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { detachedLabel, parseBranchList } from "@/lib/repo/gitBranches";

// 브랜치 목록(#1025) — 전환 드롭다운용. 로컬(최근 커밋 순) + 원격 전용. 읽기 전용, 서버 전용.
export const runtime = "nodejs";
const pexecFile = promisify(execFile);

export async function POST(request: Request): Promise<Response> {
  let rawPath: unknown;
  try { ({ path: rawPath } = await request.json()); } catch { return Response.json({ ok: false, error: "invalid body" }, { status: 400 }); }
  if (typeof rawPath !== "string" || !rawPath.trim()) return Response.json({ ok: false, error: "path required" }, { status: 400 });
  const path = rawPath.trim();
  if (!existsSync(path) || !statSync(path).isDirectory()) return Response.json({ ok: false, error: "not a directory" }, { status: 400 });
  try {
    const opts = { cwd: path, maxBuffer: 10_000_000, timeout: 8000 } as const;
    const { stdout } = await pexecFile("git", ["for-each-ref", "refs/heads", "refs/remotes", "--format=%(refname)%09%(committerdate:unix)"], opts);
    // 이전 위치(@{-1}) — "이전 위치로" 항목용. 브랜치였으면 이름, 커밋(분리)이었으면 가리키는 ref 이름·해시. 없으면 생략.
    let previous: { label: string; detached: boolean } | undefined;
    try {
      const full = (await pexecFile("git", ["rev-parse", "--symbolic-full-name", "@{-1}"], opts)).stdout.trim();
      if (full.startsWith("refs/heads/")) previous = { label: full.slice("refs/heads/".length), detached: false };
      else {
        const sha = (await pexecFile("git", ["rev-parse", "--short", "@{-1}"], opts)).stdout.trim();
        const pts = (await pexecFile("git", ["for-each-ref", "--points-at", sha, "--format=%(refname)"], opts)).stdout.split("\n");
        if (sha) previous = { label: detachedLabel(sha, pts), detached: true };
      }
    } catch { /* 이전 위치 없음(새 클론 등) */ }
    return Response.json({ ok: true, ...parseBranchList(stdout), ...(previous ? { previous } : {}) });
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return Response.json({ ok: false, error: (err.stderr || err.message || "git failed").trim().slice(0, 500) });
  }
}
