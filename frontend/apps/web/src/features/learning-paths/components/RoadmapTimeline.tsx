import type { z } from "zod";
import type { pathProgressResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";
import { PathGateBadge } from "./PathGateBadge";

type ProgressStep = z.infer<typeof pathProgressResponseSchema>["data"]["steps"][number];

type RoadmapTimelineProps = {
  pathTitle: string;
  steps: ProgressStep[];
  currentStepId: string | null;
  enrolledAt?: string | null;
};

export function RoadmapTimeline({
  pathTitle,
  steps,
  currentStepId,
  enrolledAt,
}: RoadmapTimelineProps) {
  return (
    <section aria-label={`${pathTitle} roadmap timeline`} className="space-y-4">
      <ol className="space-y-3">
        {steps.map((step) => {
          const isCurrent = step.stepId === currentStepId;
          return (
            <li
              key={step.stepId}
              className={`rounded border p-4 ${step.locked ? "opacity-70" : ""} ${isCurrent ? "border-blue-500" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide opacity-70">
                    Stage {step.position}
                  </p>
                  <h2 className="text-lg font-medium">{step.title}</h2>
                  <p className="text-sm opacity-80">
                    {step.locked
                      ? "Locked"
                      : step.progressStatus === "completed"
                        ? "Completed"
                        : "Available"}
                  </p>
                </div>
                {!step.locked && step.href ? (
                  <a href={step.href} className="text-sm underline">
                    Open step
                  </a>
                ) : null}
              </div>
              {step.gates.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {step.gates.map((gate) => (
                    <PathGateBadge key={gate.id} gate={gate} enrolledAt={enrolledAt} />
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
