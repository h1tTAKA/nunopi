export default function CodeInputArea() {
  return (
    <div className="p-8 h-full flex flex-col items-center justify-center">
      <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">Code Translator</h2>
      <p className="text-zinc-500 dark:text-zinc-400 text-center">
        코드를 입력하면 분석을 시작합니다. (v1 Placeholder)
      </p>
      <div className="mt-8 w-full max-w-2xl h-64 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
        Code Editor Area
      </div>
    </div>
  );
}
