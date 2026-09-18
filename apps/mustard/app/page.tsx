"use client";

// 홈 엔트리(#896 서브6) — nunopiEnabled 플래그로 학습 홈 vs 워크스페이스 전용 홈 분기.
// 학습 홈은 React.lazy 동적 로드 → nunopiEnabled=false(Mustard-only) 경로는 학습 청크를 안 싣는다.
// 셸(AppShell 등)은 packages/nunopi 잔류라 어느 경로든 패키지는 참조(물리 드롭은 추후 서브).
import { lazy, Suspense } from "react";
import { isNunopiEnabled } from "@/lib/product";
import WorkspaceOnlyHome from "./WorkspaceOnlyHome";

const LearningHome = lazy(() => import("./LearningHome"));

export default function Home() {
  if (!isNunopiEnabled()) return <WorkspaceOnlyHome />;
  // fallback은 앱 배경 전면 div — lazy 로드 순간 흰 화면 flash 방지(다크 테마 대비).
  return (
    <Suspense fallback={<div className="h-full w-full bg-white dark:bg-zinc-950" />}>
      <LearningHome />
    </Suspense>
  );
}
