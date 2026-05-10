export default function LearningPanel() {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-50">학습 패널</h3>
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-sm text-zinc-600 dark:text-zinc-400">
          북마크한 단어장이 여기에 표시됩니다.
        </div>
        <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-sm text-zinc-600 dark:text-zinc-400">
          최근 번역 기록이 여기에 표시됩니다.
        </div>
      </div>
    </div>
  );
}
