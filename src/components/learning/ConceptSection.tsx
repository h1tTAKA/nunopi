import type { ConceptOccurrence } from "@/lib/translator/types";

interface ConceptSectionProps {
  concepts: ConceptOccurrence[];
}

export default function ConceptSection({ concepts }: ConceptSectionProps) {
  if (concepts.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        개념이 없다.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {concepts.map((concept) => (
        <div
          key={concept.conceptId}
          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {concept.title}
            </p>
            <span className="inline-flex items-center rounded-lg bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              ×{concept.count}
            </span>
          </div>
          {concept.lines.length > 0 && (
            <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              {concept.lines.join(", ")}번 줄
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
