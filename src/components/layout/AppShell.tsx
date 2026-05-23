import Header from "./Header";

interface AppShellProps {
  children: React.ReactNode;
  learningPanel: React.ReactNode;
}

export default function AppShell({ children, learningPanel }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <Header />
      <main className="flex-1 grid grid-cols-1 md:grid-cols-[7fr_3fr] w-full max-w-7xl mx-auto">
        <div className="border-b border-zinc-200 dark:border-zinc-800 md:border-b-0 md:border-r">
          {children}
        </div>
        <aside className="bg-white dark:bg-zinc-950">
          {learningPanel}
        </aside>
      </main>
    </div>
  );
}
