import { existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// 스테이징(#947) — stage(git add) / unstage(git restore --staged). 로컬 git 쓰기. 서버 전용.
export const runtime = "nodejs";
const pexecFile = promisify(execFile);

export async function POST(request: Request): Promise<Response> {
  let path: unknown, files: unknown, action: unknown;
  try { ({ path, files, action } = await request.json()); } catch { return Response.json({ ok: false, error: "invalid body" }, { status: 400 }); }
  if (typeof path !== "string" || !path.trim()) return Response.json({ ok: false, error: "path required" }, { status: 400 });
  if (!existsSync(path) || !statSync(path).isDirectory()) return Response.json({ ok: false, error: "not a directory" }, { status: 400 });
  if (action !== "stage" && action !== "unstage") return Response.json({ ok: false, error: "invalid action" }, { status: 400 });
  if (!Array.isArray(files) || files.length === 0 || !files.every((f) => typeof f === "string" && f)) {
    return Response.json({ ok: false, error: "files required" }, { status: 400 });
  }
  // "--"로 경로를 옵션과 분리(파일명이 -로 시작해도 안전).
  const args = action === "stage" ? ["add", "--", ...files] : ["restore", "--staged", "--", ...files];
  try {
    await pexecFile("git", args, { cwd: path, maxBuffer: 20_000_000, timeout: 15000 });
    return Response.json({ ok: true });
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return Response.json({ ok: false, error: (err.stderr || err.message || "git failed").trim().slice(0, 500) });
  }
}
