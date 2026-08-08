import type { z } from "zod";
import type { learningPathDetailResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";
import { createUuid } from "../../lib/create-uuid";

export type PathStepDraft = z.infer<typeof learningPathDetailResponseSchema>["data"]["steps"][number];
export type PathGateDraft = PathStepDraft["gates"][number];
export type PathStepType = PathStepDraft["stepType"];
export type PathGateType = PathGateDraft["gateType"];

export type StepResourceOption = {
  id: string;
  title: string;
  status?: string;
};

export function createStepId(): string {
  return createUuid();
}

export function createGateId(): string {
  return createUuid();
}

export function defaultGatesForPosition(position: number): PathGateDraft[] {
  if (position <= 1) {
    return [{ id: createGateId(), gateType: "open", config: {} }];
  }
  return [{ id: createGateId(), gateType: "previous_step_completed", config: {} }];
}

export function defaultGateConfig(gateType: PathGateType): Record<string, unknown> {
  switch (gateType) {
    case "competency_band":
      return { bandKey: "ready" };
    case "time_based":
      return { daysSinceEnroll: 7 };
    case "assessment_passed":
      return {};
    default:
      return {};
  }
}

export function createGate(gateType: PathGateType): PathGateDraft {
  return {
    id: createGateId(),
    gateType,
    config: defaultGateConfig(gateType),
  };
}

export function normalizeStepPositions(steps: PathStepDraft[]): PathStepDraft[] {
  return steps.map((step, index) => ({
    ...step,
    position: index + 1,
  }));
}

export function moveStep(steps: PathStepDraft[], stepId: string, direction: "up" | "down"): PathStepDraft[] {
  const index = steps.findIndex((step) => step.id === stepId);
  if (index < 0) return steps;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= steps.length) return steps;

  const next = [...steps];
  const current = next[index];
  const target = next[targetIndex];
  if (!current || !target) return steps;

  next[index] = target;
  next[targetIndex] = current;
  return normalizeStepPositions(next);
}

export function serializeStepsForApi(steps: PathStepDraft[]) {
  return normalizeStepPositions(steps).map((step, index) => ({
    id: step.id,
    stepType: step.stepType,
    refId: step.refId,
    title: step.title.trim(),
    position: index + 1,
    gates: step.gates.map((gate) => ({
      id: gate.id,
      gateType: gate.gateType,
      config: gate.config,
    })),
  }));
}

export function resourceLabel(
  resources: StepResourceOption[],
  refId: string | null | undefined,
): string | null {
  if (!refId) return null;
  return resources.find((resource) => resource.id === refId)?.title ?? null;
}
