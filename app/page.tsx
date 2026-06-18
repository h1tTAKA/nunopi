"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LearningPanel from "@/components/learning/LearningPanel";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import CodeInputArea from "@/components/translator/CodeInputArea";
import type { AgentAnalyzeResponse, AgentProviderKind, ProviderSettings } from "@/lib/agent";
import {
  type HistoryEntry,
  saveToHistory,
  getAllHistory,
  deleteFromHistory,
  clearHistory,
} from "@/lib/historyDB";
import AnalysisHistory from "@/components/translator/AnalysisHistory";

const SETTINGS_STORAGE_KEY = "nunopi:provider-settings";

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
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    getAllHistory().then(setHistoryEntries).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setProviderSettings(JSON.parse(raw) as ProviderSettings);
    } catch { /* ignore */ }
  }, []);

  function handleSettingsSave(next: ProviderSettings) {
    setProviderSettings(next);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  useEffect(() => {
    if (isLoading) {
      document.title = "분석 중… — Nunopi";
    } else if (errorMessage) {
      document.title = "오류 — Nunopi";
    } else if (analysisResult) {
      document.title = "결과 도착 — Nunopi";
    } else {
      document.title = "Nunopi";
    }
  }, [isLoading, errorMessage, analysisResult]);

  function handleCodeChange(nextCode: string) {
    setCode(nextCode);
    if (errorMessage) {
      setErrorMessage(null);
    }
    if (analysisResult) {
      setAnalysisResult(null);
    }
  }

  function handleProviderChange(nextProviderId: AgentProviderKind) {
    setProviderId(nextProviderId);
    if (errorMessage) {
      setErrorMessage(null);
    }
    if (analysisResult) {
      setAnalysisResult(null);
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
            providerSettings,
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
      saveToHistory({
        code: nextCode,
        providerId,
        result: result.response,
        createdAt: new Date().toISOString(),
      }).then(() => getAllHistory()).then(setHistoryEntries).catch(() => {});
    } catch (error) {
      setAnalysisResult(null);
      setErrorMessage(formatFetchError(error));
    } finally {
      setIsLoading(false);
    }
  }

  function handleRestoreHistory(entry: HistoryEntry) {
    setCode(entry.code);
    setProviderId(entry.providerId);
    setAnalysisResult(entry.result);
    setErrorMessage(null);
  }

  function handleDeleteHistory(id: string) {
    deleteFromHistory(id).then(() => getAllHistory()).then(setHistoryEntries).catch(() => {});
  }

  function handleClearHistory() {
    clearHistory().then(() => setHistoryEntries([])).catch(() => {});
  }

  return (
    <>
      <section className="bg-zinc-50 dark:bg-black border-b border-zinc-200 dark:border-zinc-800 px-6 py-10 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Nunopi
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
          바이브코더를 위한 AI 코드 학습 도구
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          코드를 붙여넣으면 줄별 설명, 토큰 사전, 개념 정리를 만들어준다.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
            로컬 AI 연결
          </span>
          <span className="rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
            줄별 설명
          </span>
          <span className="rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
            토큰 사전
          </span>
          <span className="rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
            개념 정리
          </span>
        </div>
      </section>
      <AppShell
        learningPanel={
        <LearningPanel
          providerId={providerId}
          isLoading={isLoading}
          errorMessage={errorMessage}
          result={analysisResult}
          code={code}
        />
      }
    >
      <>
        <CodeInputArea
          code={code}
          providerId={providerId}
          isLoading={isLoading}
          errorMessage={errorMessage}
          hasResult={analysisResult !== null}
          onCodeChange={handleCodeChange}
          onProviderChange={handleProviderChange}
          onAnalyze={handleAnalyze}
          onSettingsOpen={() => setIsSettingsOpen(true)}
        />
        {historyEntries.length > 0 && (
          <div className="px-8 pb-4">
            <AnalysisHistory
              entries={historyEntries}
              onRestore={handleRestoreHistory}
              onDelete={handleDeleteHistory}
              onClear={handleClearHistory}
            />
          </div>
        )}
      </>
      </AppShell>
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={providerSettings}
        onSave={handleSettingsSave}
      />
    </>
  );
}

function formatFetchError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "분석 요청 중 알 수 없는 오류가 발생했다.";
}
