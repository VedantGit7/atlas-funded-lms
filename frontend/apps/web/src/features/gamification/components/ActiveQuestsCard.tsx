import Link from "next/link";
import type { LearnerQuest } from "./QuestProgressPanel";

type ActiveQuestsCardProps = {
  quests: LearnerQuest[];
};

function questCompletion(quest: LearnerQuest): { done: number; total: number } {
  const total = quest.stepProgress.length || 1;
  const done = quest.stepProgress.filter((step) => step.completedAt != null).length;
  return { done, total };
}

export function ActiveQuestsCard({ quests }: ActiveQuestsCardProps) {
  const active = quests.filter((quest) => quest.progressStatus !== "completed").slice(0, 3);

  if (active.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Active quests</h2>
        <Link href="/achievements" className="text-xs font-semibold underline">
          View all
        </Link>
      </div>
      <ul className="mt-3 space-y-3">
        {active.map((quest) => {
          const { done, total } = questCompletion(quest);
          const percent = Math.min(100, (done / total) * 100);
          return (
            <li key={quest.id}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{quest.name}</span>
                <span className="shrink-0 opacity-70">
                  {done}/{total} steps
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-black/10">
                <div
                  className="h-1.5 rounded-full bg-emerald-600"
                  style={{ width: `${String(percent)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
