// 레포 분석 그래프 스키마(부모 #585). graphify graph.json 형태 차용.
// 자식 #590은 파일 노드 + import 엣지까지. 심볼(function/component)·calls는 후속.

export type RepoNodeKind = "file" | "function" | "component" | "class" | "type";
export type RepoRelation = "imports" | "calls" | "contains" | "extends";

export interface RepoNode {
  id: string;        // 레포 루트 기준 상대경로(파일 노드) — 고유 키
  label: string;     // 표시명(파일명)
  file: string;      // 상대경로(파일)
  kind: RepoNodeKind;
  group?: string;    // 군집(자식3은 최상위 폴더 기준 임시)
}

export interface RepoEdge {
  source: string;    // RepoNode.id
  target: string;    // RepoNode.id
  relation: RepoRelation;
}

export interface RepoGraph {
  root: string;              // 분석한 레포 절대경로
  nodes: RepoNode[];
  edges: RepoEdge[];
  stats: {
    files: number;           // 그래프에 든 파일 수
    edges: number;
    scanned: number;         // 스캔한 총 지원 파일 수(상한 적용 전)
    capped: boolean;         // 상한에 걸려 잘렸는지
  };
}
