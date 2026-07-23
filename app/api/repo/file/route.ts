import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

// 레포 파일 소스 읽기(노드 LLM 설명 재료). 서버 전용. 경로 이탈(../) 방지 — 반드시 레포 루트 하위만.
export const runtime = "nodejs";

const MAX_BYTES = 200_000; // 초대형 파일 방어

export async function POST(request: Request): Promise<Response> {
  let root: unknown, file: unknown;
  try {
    ({ root, file } = await request.json());
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof root !== "string" || typeof file !== "string" || !root || !file) {
    return Response.json({ error: "root and file required" }, { status: 400 });
  }
  const rootAbs = resolve(root);
  const target = resolve(rootAbs, file);
  // 이탈 방지: target이 rootAbs 하위여야(경계에 sep 붙여 prefix 오탐 방지).
  if (target !== rootAbs && !target.startsWith(rootAbs + sep)) {
    return Response.json({ error: "path escapes repo root" }, { status: 400 });
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    return Response.json({ error: "not a file" }, { status: 400 });
  }
  try {
    let content = readFileSync(target, "utf8");
    let truncated = false;
    if (content.length > MAX_BYTES) { content = content.slice(0, MAX_BYTES); truncated = true; }
    return Response.json({ file, content, truncated });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
