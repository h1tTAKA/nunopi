"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { groupColors, REPO_NODE_FALLBACK } from "@/lib/repo/colors";
import type { RepoGraph } from "@/lib/repo/types";

// react-force-graph-2d는 canvas·window를 쓰는 브라우저 전용 → SSR 끔(서버서 안 그림).
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type GNode = { id: string; name: string; group?: string };
type GLink = { source: GNode | string; target: GNode | string };

// 툴팁 HTML 삽입용 — 파일명에 <,>,& 있으면 이스케이프(XSS 방지).
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const groupOf = (n: GNode) => n.group ?? "(root)";
const linkEnd = (e: GNode | string) => (typeof e === "object" ? e.id : e); // 링크 끝(노드객체 또는 id)

// 블래스트 색 — 직접 의존자(거리1)=빨강, 전이(거리2+)=주황.
const BLAST_DIRECT = "#ef4444";
const BLAST_TRANSITIVE = "#f59e0b";

// 이 노드 수 넘으면 "대형" — 시뮬 빨리 안정화 + 매 프레임 비용 절감(RepoView 배지도 공유).
export const LARGE_GRAPH_NODES = 600;

// 레포 그래프 — 파일 노드 + import 엣지. 색=폴더. hiddenGroups=필터, focusId=선택 강조,
// blastMap=영향도(거리별 색). 전부 접근자로 처리 → 재시뮬 없이.
export default function RepoGraphView({ graph, onNodeClick, hiddenGroups, focusId, blastMap }: {
  graph: RepoGraph;
  onNodeClick?: (id: string) => void;
  hiddenGroups?: Set<string>;
  focusId?: string | null;
  blastMap?: Map<string, number> | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { data, colorOf } = useMemo(() => {
    const groups = Array.from(new Set(graph.nodes.map((n) => n.group ?? "(root)")));
    const gc = groupColors(groups);
    const colorOf = (g?: string) => gc.get(g ?? "(root)") ?? REPO_NODE_FALLBACK;
    return {
      colorOf,
      data: {
        nodes: graph.nodes.map((n) => ({ id: n.id, name: n.label, group: n.group })),
        links: graph.edges.map((e) => ({ source: e.source, target: e.target })),
      },
    };
  }, [graph]);

  // focus 대상 = 선택 노드 + 직접 이웃. 없으면 null(전체 진하게).
  const related = useMemo(() => {
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const e of graph.edges) {
      if (e.source === focusId) set.add(e.target);
      else if (e.target === focusId) set.add(e.source);
    }
    return set;
  }, [focusId, graph]);

  const visible = (n: GNode) => !hiddenGroups?.has(groupOf(n));

  // 대형 그래프면 성능 우선: 시뮬 빨리 식히고(alphaDecay↑·cooldown↓) 첫 페인트 전 미리 자리잡고(warmup) 화살표 생략.
  const isLarge = graph.nodes.length > LARGE_GRAPH_NODES;

  return (
    <div ref={wrapRef} className="h-full w-full">
      {size.w > 0 && (
        <ForceGraph2D
          width={size.w}
          height={size.h}
          graphData={data}
          nodeLabel={(n) => `<div style="padding:3px 8px;font-size:14px;font-weight:600;border-radius:6px;background:#18181b;color:#fafafa">${escapeHtml((n as GNode).name)}</div>`}
          nodeColor={(n) => {
            const gn = n as GNode;
            if (blastMap) {                                    // 영향도 모드: 거리별 색
              const d = blastMap.get(gn.id);
              if (d === undefined) return "rgba(120,120,130,0.18)"; // 영향 밖 흐림
              if (d === 0) return colorOf(gn.group);              // 선택 파일 자신
              return d === 1 ? BLAST_DIRECT : BLAST_TRANSITIVE;   // 직접=빨강 / 전이=주황
            }
            if (related && !related.has(gn.id)) return "rgba(120,120,130,0.18)"; // focus 밖 흐림
            return colorOf(gn.group);
          }}
          nodeRelSize={6}
          nodeVal={2}
          nodeVisibility={(n) => visible(n as GNode)}
          linkVisibility={(l) => {
            const s = (l as GLink).source, t = (l as GLink).target;
            return (typeof s === "object" ? visible(s) : true) && (typeof t === "object" ? visible(t) : true);
          }}
          linkColor={(l) => {
            const s = linkEnd((l as GLink).source), t = linkEnd((l as GLink).target);
            if (blastMap) {                                    // 영향도: 영향 경로 위 엣지만 강조
              return blastMap.has(s) && blastMap.has(t) ? "rgba(239,68,68,0.45)" : "rgba(120,120,130,0.06)";
            }
            if (!related) return "rgba(120,120,130,0.22)";
            return related.has(s) && related.has(t) ? "rgba(139,134,245,0.55)" : "rgba(120,120,130,0.08)";
          }}
          linkDirectionalArrowLength={isLarge ? 0 : 2.5}
          linkDirectionalArrowRelPos={1}
          onNodeClick={(n) => onNodeClick?.((n as GNode).id)}
          onNodeHover={(n) => { const el = wrapRef.current; if (el) el.style.cursor = n ? "pointer" : "default"; }}
          cooldownTicks={isLarge ? 60 : 120}
          warmupTicks={isLarge ? 20 : 0}
          d3AlphaDecay={isLarge ? 0.05 : 0.0228}
        />
      )}
    </div>
  );
}
