export default function Header() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Code<span className="text-blue-500">Translator</span>
        </h1>
        <nav className="flex items-center gap-4">
          <button className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
            내 단어장
          </button>
          <button className="text-sm font-medium px-4 py-2 rounded-full bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 hover:opacity-90 transition-opacity">
            로그인
          </button>
        </nav>
      </div>
    </header>
  );
}
