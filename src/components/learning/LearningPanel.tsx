import type { AgentProviderKind } from "@/lib/agent";
import type { TranslateResponse } from "@/lib/translator/types";

interface LearningPanelProps {
  providerId: AgentProviderKind;
  isLoading: boolean;
  errorMessage: string | null;
  result: TranslateResponse | null;
}

export default function LearningPanel({
  providerId,
  isLoading,
  errorMessage,
  result,
}: LearningPanelProps) {
  return (
    <div className="h-full p-6 space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          학습 패널
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          현재 provider: <span className="font-medium text-zinc-700 dark:text-zinc-200">{providerId}</span>
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          분석 요청을 보낼 준비를 하고 있다.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              감지 언어: {result.language}
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              총 {result.totalLines}줄 중 {result.matchedLines}줄 설명 가능
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            토큰 {result.tokens.length}개 / 개념 {result.concepts.length}개 / 경고 {result.warnings.length}개
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            아직 분석 결과가 없다. 다음 커밋에서 API 응답이 이 패널에 연결된다.
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            결과가 들어오면 줄 설명, 토큰 사전, 개념 사전 개수가 여기부터 보이게 된다.
          </div>
        </div>
      )}
    </div>
  );
}
