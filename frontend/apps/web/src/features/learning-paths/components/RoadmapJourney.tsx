"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Info,
  Loader2,
  Lock,
  Play,
  Route as RouteIcon,
  Trophy,
} from "lucide-react";
import type { pathProgressResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";
import { clientApi, toast } from "../../../lib/client-api";

type PathProgress = z.infer<typeof pathProgressResponseSchema>["data"];
type ProgressStep = PathProgress["steps"][number];
type ProgressGate = ProgressStep["gates"][number];
type NextAction = PathProgress["nextAction"];
type NodeState = "completed" | "current" | "available" | "locked";

type RoadmapJourneyProps = {
  pathId: string;
  detailHref: string;
  enrolled: boolean;
  completedStepCount: number;
  totalStepCount: number;
  currentStepId: string | null;
  enrolledAt: string | null;
  nextAction: NextAction;
  steps: ProgressStep[];
};

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function nodeStateOf(step: ProgressStep, currentStepId: string | null): NodeState {
  if (step.progressStatus === "completed") return "completed";
  if (step.progressStatus === "in_progress" || step.stepId === currentStepId) return "current";
  if (step.locked || step.progressStatus === "locked") return "locked";
  return "available";
}

function configString(config: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function gateReason(gate: ProgressGate, enrolledAt: string | null): string {
  switch (gate.gateType) {
    case "previous_step_completed":
      return "Complete the previous step to unlock this one.";
    case "assessment_passed":
      return "Pass the required assessment to unlock.";
    case "competency_band": {
      const band = configString(gate.config, "bandKey", "minBandKey");
      const composite = configString(gate.config, "compositeKey", "dimensionKey");
      if (band && composite)
        return `Reach the ${humanize(band)} band in ${humanize(composite)} to unlock.`;
      if (band) return `Reach the ${humanize(band)} competency band to unlock.`;
      return "Reach the required competency band to unlock.";
    }
    case "time_based": {
      const availableFrom = configString(gate.config, "availableFrom");
      if (availableFrom && !Number.isNaN(Date.parse(availableFrom))) {
        const date = new Date(availableFrom);
        const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
        return daysLeft > 0
          ? `Unlocks in ${String(daysLeft)} day${daysLeft === 1 ? "" : "s"}.`
          : "Now available.";
      }
      const days = gate.config["daysSinceEnroll"];
      if (typeof days === "number" && enrolledAt) {
        const unlockAt = new Date(new Date(enrolledAt).getTime() + days * 86_400_000);
        const daysLeft = Math.ceil((unlockAt.getTime() - Date.now()) / 86_400_000);
        return daysLeft > 0
          ? `Unlocks in ${String(daysLeft)} day${daysLeft === 1 ? "" : "s"}.`
          : "Now available.";
      }
      return "Unlocks on a schedule set by your academy.";
    }
    case "manual":
      return "Unlocks with instructor approval.";
    case "open":
    default:
      return "Complete the prerequisite to unlock.";
  }
}

function lockReason(step: ProgressStep, enrolledAt: string | null): string {
  const blocking = step.gates.find((gate) => gate.state !== "satisfied");
  return blocking ? gateReason(blocking, enrolledAt) : "Finish earlier steps to unlock this one.";
}

const STEP_ICON: Record<ProgressStep["stepType"], typeof BookOpen> = {
  course: BookOpen,
  assessment: ClipboardCheck,
  path: RouteIcon,
};

export function RoadmapJourney({
  pathId,
  detailHref,
  enrolled,
  completedStepCount,
  totalStepCount,
  currentStepId,
  enrolledAt,
  nextAction,
  steps,
}: RoadmapJourneyProps) {
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);

  const percent = totalStepCount > 0 ? Math.round((completedStepCount / totalStepCount) * 100) : 0;
  const nextStep = nextAction.stepId
    ? (steps.find((s) => s.stepId === nextAction.stepId) ?? null)
    : null;
  const nextHref = nextStep?.href ?? detailHref;
  const isComplete = nextAction.type === "complete";
  const isWaiting = nextAction.type === "wait_for_gate";

  async function handleStart() {
    if (nextAction.type === "enroll") {
      if (enrolling) return;
      setEnrolling(true);
      try {
        await clientApi.post(`/api/v1/learning-paths/${pathId}/enroll`, {}, "path-enroll");
        toast.success("You're enrolled. Let's begin.");
        router.refresh();
      } catch {
        toast.error("Could not start the path. Please try again.");
        setEnrolling(false);
      }
      return;
    }
    if (!isWaiting) router.push(nextHref);
  }

  return (
    <div className="space-y-10">
      {/* Next milestone callout */}
      <section
        className="relative overflow-hidden rounded-3xl border-2 p-6 sm:p-8"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
          background:
            "radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%), color-mix(in srgb, var(--primary) 8%, var(--card))",
        }}
      >
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <span
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-lg ${isComplete ? "bg-[var(--success)]" : "bg-primary"}`}
            >
              {isComplete ? (
                <Trophy className="h-7 w-7" aria-hidden="true" />
              ) : (
                <Play className="h-8 w-8" fill="currentColor" aria-hidden="true" />
              )}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">
                {isComplete ? "Path complete" : enrolled ? "Next milestone" : "Start your journey"}
              </p>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                {isComplete ? "Every step mastered" : (nextStep?.title ?? "Begin the path")}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={enrolling || isWaiting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:opacity-95 disabled:opacity-60 motion-safe:hover:scale-[1.03] motion-safe:active:scale-95"
          >
            {enrolling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {isComplete
              ? "Review path"
              : nextAction.type === "enroll"
                ? "Start path"
                : isWaiting
                  ? nextAction.label
                  : "Start lesson"}
            {!enrolling && !isWaiting ? (
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            ) : null}
          </button>
        </div>
      </section>

      {/* Progress summary */}
      <section aria-label="Path progress">
        <div className="mb-2 flex items-end justify-between">
          <p className="text-sm font-semibold text-foreground">
            {completedStepCount} of {totalStepCount} steps complete
          </p>
          <p className="text-sm font-bold text-primary tabular-nums">{percent}%</p>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700"
            style={{ width: `${String(percent)}%` }}
          />
        </div>
      </section>

      {/* Winding path */}
      <ol className="relative mx-auto flex max-w-xl flex-col items-center py-4">
        {/* Spine */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 left-1/2 flex w-1 -translate-x-1/2 flex-col"
          aria-hidden="true"
        >
          <div
            className="w-full rounded-full bg-primary"
            style={{ height: `${String(percent)}%` }}
          />
          <div className="w-0 flex-1 self-center border-l-[3px] border-dashed border-border" />
        </div>

        {steps.map((step, index) => {
          const state = nodeStateOf(step, currentStepId);
          const left = index % 2 === 0;
          const Icon = STEP_ICON[step.stepType];
          const clickable = state !== "locked" && step.href;
          const reason = state === "locked" ? lockReason(step, enrolledAt) : null;

          const circle =
            state === "current" ? (
              <span className="relative flex h-20 w-20 items-center justify-center">
                <span
                  className="absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping"
                  aria-hidden="true"
                />
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-xl">
                  <Play className="h-8 w-8" fill="currentColor" aria-hidden="true" />
                </span>
              </span>
            ) : state === "completed" ? (
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-[var(--success)] text-success-foreground shadow-md">
                <Check className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
              </span>
            ) : state === "available" ? (
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-card text-primary shadow-md ring-2 ring-primary">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-muted text-muted-foreground shadow-sm ring-1 ring-border">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </span>
            );

          const label = (
            <div className={left ? "text-right" : "text-left"}>
              <span
                className="block text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{
                  color:
                    state === "completed"
                      ? "var(--success)"
                      : state === "locked"
                        ? "var(--muted-foreground)"
                        : "var(--primary)",
                }}
              >
                {state === "current"
                  ? "Current lesson"
                  : state === "completed"
                    ? "Completed"
                    : state === "available"
                      ? "Available"
                      : "Locked"}
              </span>
              <h3
                className={`text-base font-bold ${state === "locked" ? "text-muted-foreground" : "text-foreground"} ${state === "current" ? "text-primary" : ""}`}
              >
                {step.title}
              </h3>
            </div>
          );

          const inner = (
            <div
              className={`flex items-center gap-5 ${left ? "flex-row-reverse -translate-x-12 md:-translate-x-16" : "translate-x-12 md:translate-x-16"}`}
            >
              {circle}
              {label}
            </div>
          );

          return (
            <li
              key={step.stepId}
              className="relative z-10 flex w-full justify-center"
              style={{ marginBottom: index === steps.length - 1 ? 0 : "72px" }}
            >
              {clickable ? (
                <Link
                  href={step.href ?? detailHref}
                  aria-label={`${step.title} (${state})`}
                  className="rounded-2xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-primary motion-safe:hover:scale-[1.02]"
                >
                  {inner}
                </Link>
              ) : state === "locked" ? (
                <div
                  className="group relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  tabIndex={0}
                  role="button"
                  aria-label={`${step.title}: locked. ${reason ?? ""}`}
                  aria-describedby={`gate-${step.stepId}`}
                >
                  <div className="opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {inner}
                  </div>
                  <div
                    id={`gate-${step.stepId}`}
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 translate-y-1 rounded-xl border border-border bg-card p-4 opacity-0 shadow-xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-[var(--warning)]" aria-hidden="true" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--warning)]">
                        Prerequisite required
                      </span>
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                      {reason}
                    </p>
                  </div>
                </div>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
