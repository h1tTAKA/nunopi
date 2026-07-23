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

// 레포 그래프 — 파일 노드 + import 엣지. 색=폴더. hiddenGroups=필터, focusId=선택 강조(둘 다 접근자로, 재시뮬 없이).
export default function RepoGraphView({ graph, onNodeClick, hiddenGroups, focusId }: {
  graph: RepoGraph;
  onNodeClick?: (id: string) => void;
  hiddenGroups?: Set<string>;
  focusId?: string | null;
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
            if (!related) return "rgba(120,120,130,0.22)";
            const s = linkEnd((l as GLink).source), t = linkEnd((l as GLink).target);
            return related.has(s) && related.has(t) ? "rgba(139,134,245,0.55)" : "rgba(120,120,130,0.08)";
          }}
          linkDirectionalArrowLength={2.5}
          linkDirectionalArrowRelPos={1}
          onNodeClick={(n) => onNodeClick?.((n as GNode).id)}
          onNodeHover={(n) => { const el = wrapRef.current; if (el) el.style.cursor = n ? "pointer" : "default"; }}
          cooldownTicks={120}
        />
      )}
    </div>
  );
}
