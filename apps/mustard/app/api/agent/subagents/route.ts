// #977 서브에이전트 목록 — 호버 카드가 claude 세션 행 아래 트리로 표시. ?cwd=레포경로&title=세션제목(#970)
import { listSubagents } from "@/lib/subagents";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const sp = new URL(request.url).searchParams;
  const cwd = sp.get("cwd") ?? "";
  if (!cwd) return Response.json({ ok: false, error: "cwd required" }, { status: 400 });
  try { return Response.json({ ok: true, subagents: await listSubagents(cwd, sp.get("title") ?? "") }); }
  catch (e) { return Response.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 }); }
}
