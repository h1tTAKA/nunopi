import AppShell from "@/components/layout/AppShell";
import CodeInputArea from "@/components/translator/CodeInputArea";
import LearningPanel from "@/components/learning/LearningPanel";

export default function Home() {
  return (
    <AppShell learningPanel={<LearningPanel />}>
      <CodeInputArea />
    </AppShell>
  );
}
