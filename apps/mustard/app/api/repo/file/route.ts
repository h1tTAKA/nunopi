import { readFileSync, existsSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { classifyFile, imageMime } from "@/lib/repo/fileKind";
import { resolve, sep } from "node:path";

// 레포 파일 소스 읽기(노드 LLM 설명 재료). 서버 전용. 경로 이탈(../) 방지 — 반드시 레포 루트 하위만.
export const runtime = "nodejs";

const MAX_BYTES = 200_000; // 초대형 파일 방어(텍스트 반환 상한)
const MAX_IMAGE_BYTES = 5_000_000; // 이미지 미리보기(data URL) 상한(#657)

// 앞 n바이트만 읽기 — 큰 바이너리를 통째로 메모리에 올리지 않게(#657).
function readHead(path: string, n: number): Buffer {
  const fd = openSync(path, "r");
  try { const buf = Buffer.alloc(n); const got = readSync(fd, buf, 0, n, 0); return buf.subarray(0, got); } finally { closeSync(fd); }
}

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
    // #657: 바이너리·비UTF-8은 텍스트로 우겨 읽지 않음(깨진 글자·챗 컨텍스트 쓰레기 방지). content는 "" → 호출 측 기존 빈값 분기 그대로.
    const size = statSync(target).size;
    const head = readHead(target, Math.min(size, MAX_BYTES * 4)); // UTF-8 최대 4바이트 → 20만 자 분량
    const kind = classifyFile(head, file, head.length < size);
    if (kind !== "text") {
      const mime = kind === "image" ? imageMime(file) : null;
      const dataUrl = mime && size <= MAX_IMAGE_BYTES ? `data:${mime};base64,${readFileSync(target).toString("base64")}` : undefined;
      return Response.json({ file, content: "", truncated: false, binary: true, kind, size, ...(dataUrl ? { dataUrl } : {}) });
    }
    let content = new TextDecoder().decode(head);
    let truncated = head.length < size;
    if (content.length > MAX_BYTES) { content = content.slice(0, MAX_BYTES); truncated = true; }
    return Response.json({ file, content, truncated });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
