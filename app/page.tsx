"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LearningPanel from "@/components/learning/LearningPanel";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import CodeInputArea, { type LanguageChoice } from "@/components/translator/CodeInputArea";
import ProviderToolbar from "@/components/translator/ProviderToolbar";
import { detectLanguage } from "@/lib/translator/detectLanguage";
import type { SupportedLanguage } from "@/lib/translator/types";
import type { AgentAnalyzeResponse, AgentProviderKind, ProviderSettings } from "@/lib/agent";
import {
  type HistoryEntry,
  saveToHistory,
  getAllHistory,
  deleteFromHistory,
  clearHistory,
  updateHistory,
} from "@/lib/historyDB";

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

function generateAutoTitle(result: import("@/lib/agent").AgentAnalyzeResponse, code: string): string {
  if (result.summary?.trim()) {
    const s = result.summary.trim();
    return s.length > 40 ? s.slice(0, 40) + "…" : s;
  }
  const firstLine = code.trim().split(/\r?\n/)[0] ?? "";
  const preview = firstLine.length > 28 ? firstLine.slice(0, 28) + "…" : firstLine;
  return `${result.language}: ${preview}`;
}

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
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [languageChoice, setLanguageChoice] = useState<LanguageChoice>("auto");

  // 드롭다운이 "자동 감지"면 기존 detectLanguage로 추론, 아니면 선택값 그대로.
  // 에디터 하이라이팅 용도 — unknown은 typescript로 폴백(스니펫 대부분 JS/TS 계열).
  const editorLanguage: SupportedLanguage = useMemo(() => {
    if (languageChoice !== "auto") return languageChoice;
    const detected = detectLanguage(code).primary;
    return detected === "unknown" ? "typescript" : detected;
  }, [code, languageChoice]);

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
    setCurrentHistoryId(null);

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
        title: generateAutoTitle(result.response, nextCode),
        createdAt: new Date().toISOString(),
      }).then((savedId) => {
        setCurrentHistoryId(savedId);
        return getAllHistory();
      }).then(setHistoryEntries).catch(() => {});
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

  function handleUpdateHistory(
    id: string,
    changes: Partial<Pick<import("@/lib/historyDB").HistoryEntry, "isPinned" | "title">>,
  ) {
    updateHistory(id, changes)
      .then(() => getAllHistory())
      .then(setHistoryEntries)
      .catch(() => {});
  }

  return (
    <>
      <AppShell
        toolbar={
          <ProviderToolbar
            providerId={providerId}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onProviderChange={handleProviderChange}
            onAnalyze={handleAnalyze}
            onSettingsOpen={() => setIsSettingsOpen(true)}
          />
        }
        learningPanel={
        <LearningPanel
          providerId={providerId}
          isLoading={isLoading}
          errorMessage={errorMessage}
          result={analysisResult}
          code={code}
          historyEntries={historyEntries}
          onRestoreHistory={handleRestoreHistory}
          onDeleteHistory={handleDeleteHistory}
          onClearHistory={handleClearHistory}
          onUpdateHistory={handleUpdateHistory}
          currentHistoryId={currentHistoryId}
          currentHistoryTitle={historyEntries.find(e => e.id === currentHistoryId)?.title}
          currentHistoryIsPinned={historyEntries.find(e => e.id === currentHistoryId)?.isPinned ?? false}
          onSetCurrentTitle={(title) => { if (currentHistoryId) handleUpdateHistory(currentHistoryId, { title: title || undefined }); }}
          onToggleCurrentPin={() => {
            const entry = historyEntries.find(e => e.id === currentHistoryId);
            if (currentHistoryId && entry) handleUpdateHistory(currentHistoryId, { isPinned: !entry.isPinned });
          }}
        />
      }
        editor={
          <CodeInputArea
            code={code}
            isLoading={isLoading}
            languageChoice={languageChoice}
            editorLanguage={editorLanguage}
            onLanguageChoiceChange={setLanguageChoice}
            onCodeChange={handleCodeChange}
          />
        }
      />
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
