import Header from "./Header";

interface AppShellProps {
  toolbar: React.ReactNode;
  editor: React.ReactNode;
  learningPanel: React.ReactNode;
}

export default function AppShell({ toolbar, editor, learningPanel }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:h-screen md:min-h-0 dark:bg-black">
      <Header />

      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-7xl px-6 py-3">{toolbar}</div>
      </div>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 md:min-h-0 md:grid-cols-[7fr_3fr]">
        {/* 좌측 에디터 — Monaco가 내부 스크롤을 처리한다. */}
        <div className="min-h-0 border-b border-zinc-200 md:overflow-hidden md:border-b-0 md:border-r dark:border-zinc-800">
          {editor}
        </div>
        {/* 우측 학습패널 — 자체 세로 스크롤. */}
        <aside className="bg-white md:min-h-0 md:overflow-y-auto dark:bg-zinc-950">
          {learningPanel}
        </aside>
      </main>
    </div>
  );
}
