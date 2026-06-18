"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.Editor),
  { ssr: false, loading: () => <EditorFallback /> },
);

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
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
}: CodeEditorProps) {
  const [isDark, setIsDark] = useState(false);

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

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <MonacoEditor
        height="320px"
        language={monacoLanguage(language)}
        value={value}
        onChange={(v) => onChange(v ?? "")}
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
