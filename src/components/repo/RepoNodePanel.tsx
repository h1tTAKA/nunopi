"use client";

import { useMemo } from "react";
import { IconX, IconArrowUpRight, IconArrowDownLeft, IconFile } from "@tabler/icons-react";
import { useT } from "@/lib/i18n/I18nProvider";
import type { RepoGraph } from "@/lib/repo/types";

// 노드 클릭 우측 패널 — 구조 정보(파일·그룹·이웃 in/out). LLM 설명은 자식 #596 커밋3서 추가.
export default function RepoNodePanel({ graph, nodeId, onClose, onSelect }: {
  graph: RepoGraph;
  nodeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const node = graph.nodes.find((n) => n.id === nodeId);

  // 이웃 — out: 이 파일이 import 하는 것 / in: 이 파일을 import 하는 것.
  const { imports, importedBy } = useMemo(() => {
    const out: string[] = [];
    const inc: string[] = [];
    for (const e of graph.edges) {
      if (e.source === nodeId) out.push(e.target);
      else if (e.target === nodeId) inc.push(e.source);
    }
    return { imports: out, importedBy: inc };
  }, [graph, nodeId]);

  if (!node) return null;

  return (
    <aside className="flex w-[22rem] shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#111219]">
      <header className="flex items-start gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <IconFile size={16} stroke={2} className="mt-0.5 shrink-0 text-[#3B34E2] dark:text-[#8b86f5]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-zinc-800 dark:text-zinc-100" title={node.file}>{node.label}</p>
          <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500" title={node.file}>{node.file}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("repo.node.close")} className="shrink-0 rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
          <IconX size={16} stroke={2} aria-hidden />
        </button>
      </header>

      <div className="nunopi-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {node.group && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-zinc-400 dark:text-zinc-500">{t("repo.node.group")}</span>
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{node.group}</span>
            </div>
          )}
          <section className="flex flex-col gap-1.5">
            <h3 className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              <IconArrowUpRight size={12} stroke={2.5} aria-hidden /> {t("repo.node.imports")} ({imports.length})
            </h3>
            <NeighborList ids={imports} dir="out" onSelect={onSelect} none={t("repo.node.none")} />
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              <IconArrowDownLeft size={12} stroke={2.5} aria-hidden /> {t("repo.node.importedBy")} ({importedBy.length})
            </h3>
            <NeighborList ids={importedBy} dir="in" onSelect={onSelect} none={t("repo.node.none")} />
          </section>
        </div>
      </div>
    </aside>
  );
}

// 이웃 목록 — 파일명 클릭 시 그 노드로 이동. dir: out=imports / in=importedBy(아이콘 구분).
function NeighborList({ ids, dir, onSelect, none }: { ids: string[]; dir: "out" | "in"; onSelect: (id: string) => void; none: string }) {
  if (ids.length === 0) return <p className="text-[12px] text-zinc-400 dark:text-zinc-500">{none}</p>;
  const Icon = dir === "out" ? IconArrowUpRight : IconArrowDownLeft;
  return (
    <ul className="flex flex-col gap-0.5">
      {ids.map((id) => (
        <li key={id}>
          <button
            type="button"
            onClick={() => onSelect(id)}
            className="flex w-full items-center gap-1.5 truncate rounded px-1.5 py-1 text-left text-[12px] text-zinc-600 transition hover:bg-zinc-100 hover:text-[#3B34E2] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-[#8b86f5]"
            title={id}
          >
            <Icon size={12} stroke={2} className="shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
            <span className="truncate">{id.split("/").pop()}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
