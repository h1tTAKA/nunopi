"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Monaco, OnMount } from "@monaco-editor/react";

type MonacoEditorInstance = Parameters<OnMount>[0];
type DecorationsCollection = ReturnType<MonacoEditorInstance["createDecorationsCollection"]>;

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.Editor),
  { ssr: false, loading: () => <EditorFallback /> },
);

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  // true면 부모 컨테이너 높이를 채운다(부모가 높이를 줘야 함). false면 기존 320px 고정.
  fill?: boolean;
  // 학습패널과 링크되는 현재 활성 코드 줄(1-based). 그 줄을 하이라이트하고 화면 밖이면 reveal.
  activeLine?: number | null;
  // 에디터에서 줄을 클릭하면 호출(1-based 줄 번호).
  onLineClick?: (line: number) => void;
  // 토큰 호버/클릭 시 강조할 코드 줄들(1-based). selection 느낌으로 표시.
  markedLines?: number[];
}

function monacoLanguage(language?: string): string {
  switch (language) {
    case "react":
    case "typescript":
      return "typescript";
    case "javascript":
      return "javascript";
    case "css":
      return "css";
    case "tailwindcss":
      return "html";
    default:
      return "plaintext";
  }
}

// 학습용 스니펫이라 import/컴파일 단위가 없는 경우가 많다.
// Monaco 내장 TS/JS 진단을 끄지 않으면 거의 모든 코드에 빨간 밑줄이 생겨 학습자를 혼란시킨다.
function disableDiagnostics(monaco: Monaco) {
  const options = {
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  };
  monaco.languages?.typescript?.typescriptDefaults?.setDiagnosticsOptions(options);
  monaco.languages?.typescript?.javascriptDefaults?.setDiagnosticsOptions(options);
}

function EditorFallback() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
      에디터 로딩 중…
    </div>
  );
}

export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  fill = false,
  activeLine = null,
  onLineClick,
  markedLines,
}: CodeEditorProps) {
  const [isDark, setIsDark] = useState(false);
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const activeDecorationRef = useRef<DecorationsCollection | null>(null);
  const markedDecorationRef = useRef<DecorationsCollection | null>(null);
  // markedLines 배열은 매 렌더 새 참조라 effect 의존성으로 쓰면 과도 → 키 문자열로 비교.
  const markedKey = (markedLines ?? []).join(",");
  // onMouseDown 핸들러는 mount 시점에 한 번 등록되므로, 최신 onLineClick을 ref로 참조한다.
  const onLineClickRef = useRef(onLineClick);
  useEffect(() => {
    onLineClickRef.current = onLineClick;
  }, [onLineClick]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // 활성 줄 하이라이트 + 화면 밖이면 reveal. mount 이후 activeLine 변경마다 반영.
  function applyActiveLine() {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    if (activeLine == null) {
      activeDecorationRef.current?.clear();
      return;
    }
    const decoration = [
      {
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: { isWholeLine: true, className: "nunopi-active-line" },
      },
    ];
    if (activeDecorationRef.current) {
      activeDecorationRef.current.set(decoration);
    } else {
      activeDecorationRef.current = editor.createDecorationsCollection(decoration);
    }
    editor.revealLineInCenterIfOutsideViewport(activeLine);
  }

  useEffect(() => {
    applyActiveLine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLine]);

  // 토큰 강조 줄들 — selection 느낌의 whole-line decoration.
  function applyMarkedLines() {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const lines = markedLines ?? [];
    if (lines.length === 0) {
      markedDecorationRef.current?.clear();
      return;
    }
    const decorations = lines.map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: "nunopi-token-line" },
    }));
    if (markedDecorationRef.current) {
      markedDecorationRef.current.set(decorations);
    } else {
      markedDecorationRef.current = editor.createDecorationsCollection(decorations);
    }
  }

  useEffect(() => {
    applyMarkedLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markedKey]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onMouseDown((event) => {
      const line = event.target.position?.lineNumber;
      if (line != null) onLineClickRef.current?.(line);
    });
    applyActiveLine();
    applyMarkedLines();
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 ${
        fill ? "h-full" : ""
      }`}
    >
      <MonacoEditor
        height={fill ? "100%" : "320px"}
        language={monacoLanguage(language)}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        beforeMount={disableDiagnostics}
        onMount={handleMount}
        theme={isDark ? "vs-dark" : "light"}
        options={{
          readOnly,
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          fontFamily: "var(--font-mono)",
          automaticLayout: true,
        }}
      />
    </div>
  );
}
