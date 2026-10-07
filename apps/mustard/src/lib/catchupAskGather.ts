// 캐치업 질문 컨텍스트 수집(#998) — 최근 기록(서버 날짜별 저장소) + 코드그래프 지도 → buildCatchupContext.
import { fetchGraphDigest } from "./repo/fetchDigest";
import { buildCatchupContext, type AskItem } from "./catchupAskContext";

// 실패해도 항목만으로 답할 수 있게(각각 catch).
export async function gatherCatchupContext(root: string, item: AskItem): Promise<string> {
  const [recent, digest] = await Promise.all([
    fetch(`/api/repo/stream?root=${encodeURIComponent(root)}&limit=60`).then((r) => r.json()).then((j) => (j?.ok && Array.isArray(j.items) ? (j.items as AskItem[]) : [])).catch(() => [] as AskItem[]),
    fetchGraphDigest(root).catch(() => null),
  ]);
  return buildCatchupContext({ repo: root.split("/").filter(Boolean).pop() ?? root, item, recent, digest });
}
