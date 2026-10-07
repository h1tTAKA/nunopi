// 캐치업 항목 질문 대화(#998) — GET ?root=&key= 대화 / ?root=&counts=1 항목별 질문 수(배지). PUT {root, thread} 저장.
import { isAbsolute } from "node:path";
import { askCounts, readAsk, writeAsk } from "@/lib/catchupStore";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const sp = new URL(request.url).searchParams;
  const root = sp.get("root") ?? "";
  if (!isAbsolute(root)) return Response.json({ ok: false, error: "absolute root required" }, { status: 400 });
  try {
    if (sp.get("counts")) return Response.json({ ok: true, counts: askCounts(root) });
    return Response.json({ ok: true, thread: readAsk(root, sp.get("key") ?? "") });
  } catch (e) { return Response.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 }); }
}

export async function PUT(request: Request): Promise<Response> {
  let body: { root?: unknown; thread?: unknown };
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "bad json" }, { status: 400 }); }
  const root = typeof body.root === "string" ? body.root : "";
  if (!isAbsolute(root)) return Response.json({ ok: false, error: "absolute root required" }, { status: 400 });
  try {
    const saved = writeAsk(root, body.thread, Date.now());
    return saved ? Response.json({ ok: true, thread: saved }) : Response.json({ ok: false, error: "bad thread" }, { status: 400 });
  } catch (e) { return Response.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 }); }
}
