"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LearningPanel from "@/components/learning/LearningPanel";
import CodeInputArea from "@/components/translator/CodeInputArea";
import type { AgentProviderKind } from "@/lib/agent";
import type { TranslateResponse } from "@/lib/translator/types";

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
    useState<TranslateResponse | null>(null);

  function handleAnalyze() {
    setIsLoading(true);
    setErrorMessage(null);
    setAnalysisResult(null);
    setIsLoading(false);
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
        onCodeChange={setCode}
        onProviderChange={setProviderId}
        onAnalyze={handleAnalyze}
      />
    </AppShell>
  );
}
