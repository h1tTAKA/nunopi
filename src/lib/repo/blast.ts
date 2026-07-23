import type { RepoGraph } from "./types";

// 블래스트 반경 — 이 파일(nodeId)을 바꾸면 영향받는 파일들과 그 거리.
//
// import 엣지는 source→target(source가 target을 import 해서 씀).
// target을 바꾸면 그걸 쓰는 source가 깨진다. 그 source를 또 쓰는 놈도 전이로 깨진다.
// 그래서 "target==현재"인 엣지의 source로 거꾸로 타고 올라가는 = 역방향 BFS.
//
// 반환: id → 거리 Map (0=자기 자신, 1=직접 의존자, 2+=전이 의존자).
export function blastRadius(graph: RepoGraph, nodeId: string): Map<string, number> {
  // 역인접 리스트: target → 그 target을 import 하는 source들.
  const dependents = new Map<string, string[]>();
  for (const e of graph.edges) {
    const arr = dependents.get(e.target);
    if (arr) arr.push(e.source);
    else dependents.set(e.target, [e.source]);
  }

  const dist = new Map<string, number>([[nodeId, 0]]);
  let frontier = [nodeId];
  let depth = 0;
  // BFS: 한 겹씩 바깥으로. 처음 도달한 거리가 최단(=진짜 영향 단계).
  while (frontier.length) {
    depth++;
    const next: string[] = [];
    for (const id of frontier) {
      for (const dep of dependents.get(id) ?? []) {
        if (!dist.has(dep)) { dist.set(dep, depth); next.push(dep); }
      }
    }
    frontier = next;
  }
  return dist;
}
