import {
  Activity,
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Flame,
  Gift,
  Medal,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  describeQuestRewards,
  describeQuestStep,
  type QuestDto,
  type QuestStep,
  type QuestStepProgress,
} from "../quest-shared";
import { questOverallPercent, questStatusMeta } from "../gamification-view";

export type LearnerQuest = QuestDto & {
  progressStatus: "not_started" | "in_progress" | "completed";
  stepProgress: QuestStepProgress[];
  completedAt: string | null;
};

type QuestProgressPanelProps = {
  quests: LearnerQuest[];
};

function questIcon(step: QuestStep | undefined): LucideIcon {
  if (!step) return Target;
  switch (step.type) {
    case "complete_lessons":
      return BookOpen;
    case "earn_xp":
      return Zap;
    case "maintain_streak":
      return Flame;
    case "earn_badge":
      return Medal;
    case "complete_assessment":
      return ClipboardCheck;
    case "event_count":
      return Activity;
  }
}

export function QuestProgressPanel({ quests }: QuestProgressPanelProps) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Active quests</h2>

      {quests.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Target className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground">No active quests right now</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            New quests appear here as your program adds them. Keep learning to stay ready.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {quests.map((quest) => {
            const percent = questOverallPercent(quest.stepProgress);
            const status = questStatusMeta(quest.progressStatus);
            const Icon = questIcon(quest.criteria.steps[0]);
            const rewardLabel = describeQuestRewards(quest.rewards);

            return (
              <article key={quest.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">{quest.name}</h3>
                        {quest.description ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {quest.description}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.chipClassName}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div
                        className="h-2 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                        aria-label={`${quest.name} overall progress`}
                      >
                        <div
                          className={`h-full rounded-full ${
                            quest.progressStatus === "completed"
                              ? "bg-[color-mix(in_srgb,var(--success)_82%,var(--foreground))]"
                              : "bg-primary"
                          }`}
                          style={{ width: `${String(percent)}%` }}
                        />
                      </div>
                    </div>

                    {quest.criteria.steps.length > 1 ? (
                      <ul className="mt-3 space-y-1.5">
                        {quest.criteria.steps.map((step, index) => {
                          const stepProgress = quest.stepProgress[index] ?? {
                            progress: 0,
                            target: 1,
                            completedAt: null,
                          };
                          const done = stepProgress.completedAt != null;
                          return (
                            <li
                              key={index}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                {done ? (
                                  <CheckCircle2
                                    className="h-3.5 w-3.5 shrink-0 text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))]"
                                    strokeWidth={2.5}
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Circle
                                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                    strokeWidth={2}
                                    aria-hidden="true"
                                  />
                                )}
                                <span
                                  className={
                                    done
                                      ? "truncate text-muted-foreground line-through"
                                      : "truncate text-foreground"
                                  }
                                >
                                  {describeQuestStep(step)}
                                </span>
                              </span>
                              <span className="shrink-0 text-muted-foreground tabular-nums">
                                {stepProgress.progress}/{stepProgress.target}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--success)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))]">
                        <Gift className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                        {rewardLabel}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                        {percent}%
                        {quest.endsAt
                          ? ` · Ends ${new Date(quest.endsAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
