import type { AgentAnalyzeResponse, AgentProviderKind } from "@/lib/agent";

interface LearningPanelProps {
  providerId: AgentProviderKind;
  isLoading: boolean;
  errorMessage: string | null;
  result: AgentAnalyzeResponse | null;
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
          agent bridge API에 분석 요청을 보내는 중이다.
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
              provider 응답 요약: {result.summary}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              줄 설명 {result.lineExplanations.length}개
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              토큰 {result.tokens.length}개 / 개념 {result.concepts.length}개
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            경고 {result.warnings.length}개 / 생성 시각 {new Date(result.createdAt).toLocaleString("ko-KR")}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            아직 분석 결과가 없다. 이 커밋부터는 버튼을 누르면 실제 route 응답이 이 패널로 들어온다.
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            성공하면 요약, 줄 설명 개수, 토큰/개념 개수, 경고 수가 우선 표시된다.
          </div>
        </div>
      )}
    </div>
  );
}
