import { existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// 브랜치 생성(#948) — git switch -c <name>(생성 + 전환). 로컬 git 쓰기. 서버 전용.
export const runtime = "nodejs";
const pexecFile = promisify(execFile);

export async function POST(request: Request): Promise<Response> {
  let rawPath: unknown, name: unknown;
  try { ({ path: rawPath, name } = await request.json()); } catch { return Response.json({ ok: false, error: "invalid body" }, { status: 400 }); }
  if (typeof rawPath !== "string" || !rawPath.trim()) return Response.json({ ok: false, error: "path required" }, { status: 400 });
  const path = rawPath.trim(); // 후행 공백 제거 후 일관 사용(검증·cwd 동일 값)
  if (!existsSync(path) || !statSync(path).isDirectory()) return Response.json({ ok: false, error: "not a directory" }, { status: 400 });
  if (typeof name !== "string" || !name.trim() || /\s/.test(name.trim())) return Response.json({ ok: false, error: "invalid branch name" }, { status: 400 });
  try {
    // switch -c: 새 브랜치 생성 + 전환. name은 별개 인자(인젝션 안전), git이 유효성 최종 판정.
    await pexecFile("git", ["switch", "-c", name.trim()], { cwd: path, maxBuffer: 20_000_000, timeout: 15000 });
    return Response.json({ ok: true });
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return Response.json({ ok: false, error: (err.stderr || err.message || "git failed").trim().slice(0, 500) });
  }
}
