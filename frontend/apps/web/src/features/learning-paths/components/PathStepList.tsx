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
};

export function PathStepList({ steps, progressSteps = [], enrolledAt }: PathStepListProps) {
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
                  {step.stepType}
                  {progress ? ` · ${progress.progressStatus}` : ""}
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
