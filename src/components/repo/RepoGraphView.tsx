"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { RepoGraph } from "@/lib/repo/types";

// react-force-graph-2d는 canvas·window를 쓰는 브라우저 전용 → SSR 끔(서버서 안 그림).
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// 그룹(폴더)별 색 팔레트 — 순환.
const PALETTE = ["#3B34E2", "#0ea5e9", "#10b981", "#d946ef", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16"];

type GNode = { id: string; name: string; group?: string };

// 레포 그래프 시각화 — 파일 노드 + import 엣지를 force 레이아웃 캔버스로. 색=폴더. 줌/팬 기본.
export default function RepoGraphView({ graph, onNodeClick }: { graph: RepoGraph; onNodeClick?: (id: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // 컨테이너 크기 측정(그래프에 width/height 픽셀 필요) + 리사이즈 추종.
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
    const gc = new Map(groups.map((g, i) => [g, PALETTE[i % PALETTE.length]]));
    const colorOf = (g?: string) => gc.get(g ?? "(root)") ?? "#71717a";
    return {
      colorOf,
      data: {
        nodes: graph.nodes.map((n) => ({ id: n.id, name: n.label, group: n.group })),
        links: graph.edges.map((e) => ({ source: e.source, target: e.target })),
      },
    };
  }, [graph]);

  return (
    <div ref={wrapRef} className="h-full w-full">
      {size.w > 0 && (
        <ForceGraph2D
          width={size.w}
          height={size.h}
          graphData={data}
          nodeLabel="name"
          nodeColor={(n) => colorOf((n as GNode).group)}
          nodeRelSize={4}
          linkColor={() => "rgba(120,120,130,0.22)"}
          linkDirectionalArrowLength={2.5}
          linkDirectionalArrowRelPos={1}
          onNodeClick={(n) => onNodeClick?.((n as GNode).id)}
          cooldownTicks={120}
        />
      )}
    </div>
  );
}
