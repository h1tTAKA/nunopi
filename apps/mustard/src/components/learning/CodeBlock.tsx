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
  const [isDark, setIsDark] = useState(false);

  // 테마 토글 시 재하이라이트하려면 html.dark 변화를 추적해야 한다. mount 때 색을 한 번만
  // 읽으면 다크↔라이트 전환 후 Shiki 색이 옛 테마 그대로라 새 배경과 충돌해 안 보인다.
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

  useEffect(() => {
    let cancelled = false;
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
  }, [code, language, isDark]);

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
