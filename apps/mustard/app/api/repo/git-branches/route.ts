import { existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseBranchList } from "@/lib/repo/gitBranches";

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
    const { stdout } = await pexecFile("git", ["for-each-ref", "refs/heads", "refs/remotes", "--format=%(refname)%09%(committerdate:unix)"], { cwd: path, maxBuffer: 10_000_000, timeout: 8000 });
    return Response.json({ ok: true, ...parseBranchList(stdout) });
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return Response.json({ ok: false, error: (err.stderr || err.message || "git failed").trim().slice(0, 500) });
  }
}
