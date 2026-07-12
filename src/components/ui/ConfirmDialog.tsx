"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  // true면 확인 버튼을 위험(빨강)으로 — 삭제 등 되돌릴 수 없는 동작.
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

// 네이티브 window.confirm 대신 앱 자체 모달. `const confirm = useConfirm()` 후
// `if (await confirm({ message, danger }))` 형태로 사용.
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      // 이전 confirm이 아직 열려 있으면 취소로 정리(promise 누수 방지).
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <ConfirmModal
          options={options}
          onCancel={() => close(false)}
          onConfirm={() => close(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmModal({
  options,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  // Esc=취소, Enter=확인.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative z-[81] w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-[#111219]"
      >
        {options.title && (
          <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {options.title}
          </h2>
        )}
        <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {options.message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {options.cancelText ?? t("confirm.cancel")}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
              options.danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#3B34E2] hover:bg-[#322bc9]"
            }`}
          >
            {options.confirmText ?? t("confirm.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
