import { existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// 로컬 최신화(#946) — fetch(원격 참조만) / pull(--ff-only, fast-forward만 안전). 서버 전용.
export const runtime = "nodejs";
const pexecFile = promisify(execFile);

export async function POST(request: Request): Promise<Response> {
  let path: unknown, action: unknown;
  try { ({ path, action } = await request.json()); } catch { return Response.json({ ok: false, error: "invalid body" }, { status: 400 }); }
  if (typeof path !== "string" || !path.trim()) return Response.json({ ok: false, error: "path required" }, { status: 400 });
  if (!existsSync(path) || !statSync(path).isDirectory()) return Response.json({ ok: false, error: "not a directory" }, { status: 400 });
  if (action !== "pull" && action !== "fetch") return Response.json({ ok: false, error: "invalid action" }, { status: 400 });

  // pull은 --ff-only(fast-forward만) — 충돌·머지 커밋 방지. non-ff면 git이 실패.
  const args = action === "pull" ? ["pull", "--ff-only"] : ["fetch"];
  try {
    const { stdout, stderr } = await pexecFile("git", args, { cwd: path, maxBuffer: 20_000_000, timeout: 30000 });
    return Response.json({ ok: true, stdout: (stdout || stderr || "").trim() });
  } catch (e) {
    // non-ff pull, 네트워크 오류 등 — stderr에 사유. 앱 에러 아님(사용자 안내용).
    const err = e as { stderr?: string; message?: string };
    return Response.json({ ok: false, error: (err.stderr || err.message || "git failed").trim().slice(0, 500) });
  }
}
