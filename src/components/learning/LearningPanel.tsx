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
  const firstExplanation = result?.lineExplanations[0];
  const firstWarning = result?.warnings[0];

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
          agent bridge API에 분석 요청을 보내는 중이다. 로딩 중에는 입력과 provider 선택이 잠깐 잠긴다.
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

          {firstExplanation ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                첫 줄 설명 미리보기
              </p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {firstExplanation.line}번 줄
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                {firstExplanation.code}
              </pre>
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
                {firstExplanation.explanation}
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            경고 {result.warnings.length}개 / 생성 시각 {new Date(result.createdAt).toLocaleString("ko-KR")}
            {firstWarning ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                첫 경고: {firstWarning.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            아직 분석 결과가 없다. 버튼을 누르면 route 응답이 이 패널로 들어오고, 성공 시 요약과 첫 줄 설명 미리보기가 뜬다.
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            실패하면 이전 결과 대신 에러 메시지를 먼저 보여줘서 상태가 섞이지 않게 유지한다.
          </div>
        </div>
      )}
    </div>
  );
}
