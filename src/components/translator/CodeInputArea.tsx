export default function CodeInputArea() {
  return (
    <div className="p-8 h-full flex flex-col items-center justify-center">
      <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">Nunopi</h2>
      <p className="text-zinc-500 dark:text-zinc-400 text-center">
        개발을 잘 모르는 바이브코더들을 위한 눈높이 AI 코드 학습 도구입니다.
      </p>
      <div className="mt-8 w-full max-w-2xl h-64 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
        Code Editor Area
      </div>
    </div>
  );
}
