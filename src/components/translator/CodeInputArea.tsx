import type { AgentProviderKind } from "@/lib/agent";

interface CodeInputAreaProps {
  code: string;
  providerId: AgentProviderKind;
  isLoading: boolean;
  errorMessage: string | null;
  onCodeChange: (nextCode: string) => void;
  onProviderChange: (providerId: AgentProviderKind) => void;
  onAnalyze: () => void | Promise<void>;
}

export default function CodeInputArea({
  code,
  providerId,
  isLoading,
  errorMessage,
  onCodeChange,
  onProviderChange,
  onAnalyze,
}: CodeInputAreaProps) {
  const isAnalyzeDisabled = isLoading || code.trim().length === 0;

  return (
    <div className="h-full p-8 flex flex-col gap-6 bg-zinc-50 dark:bg-black">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Nunopi
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          코드를 붙여넣고, 어떤 provider로 분석할지 고른 뒤 실제 agent bridge API에 분석을 요청한다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            코드 입력
          </span>
          <textarea
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            placeholder="설명받고 싶은 코드를 붙여넣으세요."
            disabled={isLoading}
            className="min-h-[320px] w-full rounded-2xl border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-900 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-700"
          />
        </label>

        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              분석 provider
            </span>
            <select
              value={providerId}
              disabled={isLoading}
              onChange={(event) =>
                onProviderChange(event.target.value as AgentProviderKind)
              }
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
            >
              <option value="local-rules">local-rules</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              void onAnalyze();
            }}
            disabled={isAnalyzeDisabled}
            className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-50 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {isLoading ? "분석 요청 중..." : "분석 요청하기"}
          </button>

          <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            현재는 `local-rules` provider를 route를 통해 호출한다. 이후 이 자리에 다른 agent provider도 추가된다.
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
