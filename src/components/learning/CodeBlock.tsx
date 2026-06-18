"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

function shikiLang(language?: string): string {
  switch (language) {
    case "react":
    case "typescript":
      return "tsx";
    case "javascript":
      return "jsx";
    case "css":
      return "css";
    case "tailwindcss":
      return "html";
    default:
      return "tsx";
  }
}

export default function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");
    codeToHtml(code, {
      lang: shikiLang(language),
      theme: isDark ? "github-dark" : "github-light",
    })
      .then((out) => {
        if (!cancelled) setHtml(out);
      })
      .catch(() => {
        if (!cancelled) setHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const wrapperClass = `overflow-x-auto rounded-xl p-3 text-xs [&_pre]:!bg-transparent [&_pre]:!m-0 ${className ?? ""}`;

  if (!html) {
    // Shiki 로딩 전/실패 fallback — plain pre
    return (
      <pre className={`${wrapperClass} bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200`}>
        {code}
      </pre>
    );
  }

  return (
    <div
      className={`${wrapperClass} bg-white dark:bg-zinc-950`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
