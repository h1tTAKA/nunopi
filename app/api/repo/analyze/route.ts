import { existsSync, statSync } from "node:fs";
import { buildRepoGraph } from "@/lib/repo/graph";

// 로컬 레포 폴더 → import 그래프(부모 #585 자식 #590). 서버(Node) 전용 — fs·TS 컴파일러 사용.
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let path: unknown;
  try {
    ({ path } = await request.json());
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof path !== "string" || !path.trim()) {
    return Response.json({ error: "path required" }, { status: 400 });
  }
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    return Response.json({ error: "not a directory" }, { status: 400 });
  }
  try {
    const graph = buildRepoGraph(path);
    return Response.json(graph);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
