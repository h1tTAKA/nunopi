// #987 모델 목록 — 설정 화면 모드별 모델 선택. ?providerId=claude-agent|codex-agent|opencode-agent
import type { AgentProviderKind } from "@mustard/core";
import { listSnaModels } from "@mustard/nunopi/server";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const providerId = new URL(request.url).searchParams.get("providerId") ?? "";
  try {
    const r = await listSnaModels(providerId as AgentProviderKind);
    if (!r) return Response.json({ ok: false, error: "unsupported providerId" }, { status: 400 }); // 모르는 id는 RUNTIME_OF에서 걸러짐
    return Response.json({ ok: true, ...r });
  } catch (e) { return Response.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 }); }
}
