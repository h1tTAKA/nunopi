import { existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// 커밋(#947) — staged 변경을 git commit -m. 로컬 git 쓰기. 서버 전용.
export const runtime = "nodejs";
const pexecFile = promisify(execFile);

export async function POST(request: Request): Promise<Response> {
  let path: unknown, message: unknown;
  try { ({ path, message } = await request.json()); } catch { return Response.json({ ok: false, error: "invalid body" }, { status: 400 }); }
  if (typeof path !== "string" || !path.trim()) return Response.json({ ok: false, error: "path required" }, { status: 400 });
  if (!existsSync(path) || !statSync(path).isDirectory()) return Response.json({ ok: false, error: "not a directory" }, { status: 400 });
  if (typeof message !== "string" || !message.trim()) return Response.json({ ok: false, error: "message required" }, { status: 400 });
  try {
    // staged 없으면 git이 "nothing to commit"로 실패 → catch서 안내.
    const { stdout } = await pexecFile("git", ["commit", "-m", message.trim()], { cwd: path, maxBuffer: 20_000_000, timeout: 15000 });
    return Response.json({ ok: true, stdout: (stdout || "").trim() });
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    return Response.json({ ok: false, error: (err.stderr || err.stdout || err.message || "git failed").trim().slice(0, 500) });
  }
}
