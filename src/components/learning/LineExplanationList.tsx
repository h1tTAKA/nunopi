import type { AgentLineExplanation } from "@/lib/agent";

interface LineExplanationListProps {
  lineExplanations: AgentLineExplanation[];
}

export default function LineExplanationList({
  lineExplanations,
}: LineExplanationListProps) {
  if (lineExplanations.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        줄 설명이 없다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lineExplanations.map((item, i) => (
        <div
          key={`${i}-${item.line}`}
          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center rounded-lg bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              {item.line}번 줄
            </span>
            {item.confidence != null && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {Math.round(item.confidence * 100)}%
              </span>
            )}
          </div>
          <pre className="overflow-x-auto rounded-xl bg-white p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
            {item.code}
          </pre>
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
            {item.explanation}
          </p>
        </div>
      ))}
    </div>
  );
}
