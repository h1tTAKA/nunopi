"use client";

// 첫 실행 온보딩(#902) — nunopi 학습툴 on/off + 언어 + 에이전트 CLI 경로를 정하고 영속한다.
// mustard:onboarded 플래그가 없을 때만 page.tsx가 이 화면을 보여준다. 테마 선택은 제외(라이트 모드 수정 후 별도).
import { useEffect, useState } from "react";
import { I18nProvider, useLocale, useT, LOCALES, type Locale } from "@mustard/core";
import { setNunopiEnabled } from "@/lib/product";
import { IconFolderOpen, IconSparkles } from "@tabler/icons-react";

type CliPaths = { claudeCode?: string; codex?: string; opencode?: string };

function OnboardingInner({ onDone }: { onDone: () => void }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [nunopi, setNunopi] = useState(true);
  const [paths, setPaths] = useState<CliPaths>({});
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const d = typeof window !== "undefined" && !!window.nunopiDesktop;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(d);
    if (d) window.nunopiDesktop?.getRuntimePaths().then((p) => setPaths((prev) => ({ ...prev, ...p }))).catch(() => {});
  }, []);

  async function finish() {
    setNunopiEnabled(nunopi);          // 언어는 setLocale이 이미 실시간 영속.
    // CLI 경로 저장은 IPC(async) — onDone으로 언마운트되기 전에 완료 대기(유실 방지).
    if (isDesktop) {
      try { await window.nunopiDesktop?.setRuntimePaths(paths); } catch { /* 실패해도 진행(resolver 폴백) */ }
    }
    try { localStorage.setItem("mustard:onboarded", "1"); } catch { /* ignore */ }
    onDone();
  }

  const CLI: { key: keyof CliPaths; label: string; ph: string }[] = [
    { key: "claudeCode", label: "Claude Code", ph: "claude" },
    { key: "codex", label: "Codex", ph: "codex" },
    { key: "opencode", label: "OpenCode", ph: "opencode" },
  ];

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-zinc-950 p-8 text-zinc-100">
      <div className="flex w-full max-w-md flex-col gap-6">
        {/* 워드마크 + 환영 */}
        <div className="text-center">
          <div className="text-3xl font-bold tracking-tight text-mustard-400">Mustard</div>
          <p className="mt-2 text-sm text-zinc-400">{t("onboarding.welcome")}</p>
        </div>

        {/* 언어 */}
        <section className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400">{t("onboarding.langLabel")}</label>
          <div className="inline-flex rounded-xl border border-zinc-700 bg-zinc-900 p-0.5">
            {LOCALES.map((l) => (
              <button key={l.value} type="button" onClick={() => setLocale(l.value as Locale)}
                className={`rounded-lg px-4 py-1.5 text-sm transition ${locale === l.value ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"}`}>
                {l.label}
              </button>
            ))}
          </div>
        </section>

        {/* nunopi 학습 모듈 on/off */}
        <section className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconSparkles size={18} stroke={1.75} className="text-mustard-400" aria-hidden />
              <span className="text-sm font-semibold text-zinc-100">{t("onboarding.nunopiLabel")}</span>
            </div>
            <button type="button" role="switch" aria-checked={nunopi} aria-label={t("onboarding.nunopiLabel")}
              onClick={() => setNunopi((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${nunopi ? "bg-mustard-500" : "bg-zinc-700"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${nunopi ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-zinc-400">{t("onboarding.nunopiDesc")}</p>
        </section>

        {/* 에이전트 CLI 경로 — 데스크톱만 */}
        {isDesktop && (
          <section className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400">{t("onboarding.cliLabel")}</label>
            <p className="text-xs text-zinc-500">{t("onboarding.cliDesc")}</p>
            <div className="space-y-2">
              {CLI.map(({ key, label, ph }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs text-zinc-400">{label}</span>
                  <input type="text" value={paths[key] ?? ""} placeholder={ph}
                    onChange={(e) => setPaths((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 시작 */}
        <button type="button" onClick={finish}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-mustard-500 px-4 py-2.5 text-sm font-semibold text-brown-900 transition hover:bg-mustard-400">
          <IconFolderOpen size={16} stroke={2} aria-hidden /> {t("onboarding.start")}
        </button>
      </div>
    </div>
  );
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  // 온보딩 자체 provider(언어 선택이 useLocale·useT를 써야 함). 홈들도 각자 provider를 가짐.
  return (
    <I18nProvider>
      <OnboardingInner onDone={onDone} />
    </I18nProvider>
  );
}
