import type { z } from "zod";
import type {
  learningPathDetailResponseSchema,
  pathProgressResponseSchema,
} from "@atlas/contracts/learning-paths/learning-path.schemas";
import { PathGateBadge } from "./PathGateBadge";

type PathStep = z.infer<typeof learningPathDetailResponseSchema>["data"]["steps"][number];
type ProgressStep = z.infer<typeof pathProgressResponseSchema>["data"]["steps"][number];

type PathStepListProps = {
  steps: PathStep[];
  progressSteps?: ProgressStep[];
  enrolledAt?: string | null;
  /** Before the learner starts the path every step reads as locked; say why. */
  enrolled?: boolean;
};

const STEP_TYPE_LABELS: Record<PathStep["stepType"], string> = {
  course: "Course",
  assessment: "Assessment",
  path: "Learning path",
};

/** Plain words for a step's state (QA review 2 H19: "course · in_progress"). */
export function stepStatusLabel(
  progress: ProgressStep | undefined,
  enrolled: boolean,
  position: number,
): string {
  if (!enrolled) return position === 1 ? "First step" : "Unlocks as you go";
  switch (progress?.progressStatus) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "unlocked":
      return "Ready to start";
    default:
      return "Locked";
  }
}

export function PathStepList({
  steps,
  progressSteps = [],
  enrolledAt,
  enrolled = true,
}: PathStepListProps) {
  const progressByStep = new Map(progressSteps.map((step) => [step.stepId, step]));

  return (
    <ol className="space-y-3">
      {steps.map((step) => {
        const progress = progressByStep.get(step.id);
        const locked = progress?.locked ?? true;
        return (
          <li key={step.id} className="rounded border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-70">Step {step.position}</p>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm opacity-80">
                  {STEP_TYPE_LABELS[step.stepType]} ·{" "}
                  {stepStatusLabel(progress, enrolled, step.position)}
                </p>
              </div>
              {!locked && progress?.href ? (
                <a href={progress.href} className="text-sm underline">
                  Continue
                </a>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {step.gates.map((gate) => (
                <PathGateBadge
                  key={gate.id}
                  gate={{
                    ...gate,
                    state: progress?.gates.find((item) => item.id === gate.id)?.state ?? "locked",
                  }}
                  enrolledAt={enrolledAt}
                />
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
