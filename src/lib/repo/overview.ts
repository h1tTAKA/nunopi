import type { RepoGraph } from "./types";

// "레포 한눈에" 리포트 — 그래프 통계만으로(새 파싱 X) 비개발자용 요약 재료 뽑기.
export interface RepoOverview {
  groups: { group: string; count: number }[];               // 폴더별 파일 수, 많은 순
  godNodes: { id: string; label: string; degree: number }[]; // 연결(degree) 많은 순 top — 핵심/위험 파일
  entryPoints: { id: string; label: string }[];              // 아무도 안 씀(in0) + 남을 씀(out>0) = 시작점
}

const TOP = 8;

export function repoOverview(graph: RepoGraph): RepoOverview {
  // 1) 그룹(폴더)별 파일 수.
  const groupCounts = new Map<string, number>();
  for (const n of graph.nodes) {
    const g = n.group ?? "(root)";
    groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
  }
  const groups = [...groupCounts.entries()]
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count);

  // 2) in/out degree — 엣지 한 번 훑어 양방향 연결 수 집계.
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  for (const e of graph.edges) {
    outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1); // source가 뭔가를 씀
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);   // target이 쓰임당함
  }

  // god node = 총 연결(in+out) 많은 파일 = 건드리면 파장 큰 중심.
  const godNodes = graph.nodes
    .map((n) => ({ id: n.id, label: n.label, degree: (inDeg.get(n.id) ?? 0) + (outDeg.get(n.id) ?? 0) }))
    .filter((n) => n.degree > 0)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, TOP);

  // 진입점 = 아무도 import 안 하지만(in0) 남을 import 하는(out>0) 최상위 = 읽기 시작점.
  const entryPoints = graph.nodes
    .filter((n) => (inDeg.get(n.id) ?? 0) === 0 && (outDeg.get(n.id) ?? 0) > 0)
    .map((n) => ({ id: n.id, label: n.label }))
    .slice(0, TOP);

  return { groups, godNodes, entryPoints };
}
