"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LearningPanel from "@/components/learning/LearningPanel";
import CodeInputArea from "@/components/translator/CodeInputArea";
import type { AgentAnalyzeResponse, AgentProviderKind } from "@/lib/agent";

interface AnalyzeApiSuccessResponse {
  ok: true;
  providerId: AgentProviderKind;
  response: AgentAnalyzeResponse;
}

interface AnalyzeApiErrorResponse {
  ok: false;
  error: {
    code:
      | "INVALID_REQUEST"
      | "PROVIDER_NOT_FOUND"
      | "PROVIDER_TIMEOUT"
      | "PROVIDER_FAILED";
    message: string;
    providerId?: string;
  };
}

const DEFAULT_PROVIDER_ID: AgentProviderKind = "local-rules";
const DEFAULT_CODE = `const [count, setCount] = useState(0);\n\nreturn <button className="px-4 py-2">{count}</button>;`;

export default function Home() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [providerId, setProviderId] = useState<AgentProviderKind>(
    DEFAULT_PROVIDER_ID,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<AgentAnalyzeResponse | null>(null);

  function handleCodeChange(nextCode: string) {
    setCode(nextCode);
    if (errorMessage) {
      setErrorMessage(null);
    }
  }

  function handleProviderChange(nextProviderId: AgentProviderKind) {
    setProviderId(nextProviderId);
    if (errorMessage) {
      setErrorMessage(null);
    }
  }

  async function handleAnalyze() {
    const nextCode = code.trim();

    if (!nextCode) {
      setErrorMessage("분석할 코드를 먼저 입력해야 한다.");
      setAnalysisResult(null);
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerId,
          request: {
            code: nextCode,
            locale: "ko",
            providerId,
          },
        }),
      });

      const result = (await response.json()) as
        | AnalyzeApiSuccessResponse
        | AnalyzeApiErrorResponse;

      if (!response.ok || !result.ok) {
        setAnalysisResult(null);
        setErrorMessage(result.ok ? "분석 요청이 실패했다." : result.error.message);
        return;
      }

      setAnalysisResult(result.response);
    } catch (error) {
      setAnalysisResult(null);
      setErrorMessage(formatFetchError(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell
      learningPanel={
        <LearningPanel
          providerId={providerId}
          isLoading={isLoading}
          errorMessage={errorMessage}
          result={analysisResult}
        />
      }
    >
      <CodeInputArea
        code={code}
        providerId={providerId}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onCodeChange={handleCodeChange}
        onProviderChange={handleProviderChange}
        onAnalyze={handleAnalyze}
      />
    </AppShell>
  );
}

function formatFetchError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "분석 요청 중 알 수 없는 오류가 발생했다.";
}
