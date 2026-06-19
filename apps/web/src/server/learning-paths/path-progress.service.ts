import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import {
  buildStepsWithGates,
  findCompositeReadinessBand,
  findCompetencyBandRank,
  findPassedAssessmentAttempt,
  listPathStepGates,
  listPathStepProgress,
  listPathSteps,
  mapGateType,
  mapStepType,
  upsertPathStepProgress,
} from "./learning-path.repository";
import {
  compareBandKeys,
  deriveProgressStatus,
  evaluateGateState,
  readAssessmentIdFromGateConfig,
  readCompetencyBandConfig,
  stepHref,
  stepLockedFromGates,
} from "./path-gate.service";
import type { PathProgressDto } from "./learning-path.types";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

type StepBundle = {
  id: string;
  stepType: ReturnType<typeof mapStepType>;
  refId: string | null;
  title: string;
  position: number;
  gates: Array<{
    id: string;
    gateType: ReturnType<typeof mapGateType>;
    config: Record<string, unknown>;
  }>;
};

export async function buildPathProgress(
  tx: TenantTx,
  ctx: ServiceCtx,
  pathId: string,
  enrolled: boolean,
  enrollmentId: string | null,
): Promise<PathProgressDto> {
  const stepsRaw = await listPathSteps({ tx, pathId });
  const stepIds = stepsRaw.map((step) => step.id);
  const gatesRaw = await listPathStepGates({ tx, stepIds });
  const bundled = buildStepsWithGates(stepsRaw, gatesRaw);

  const steps: StepBundle[] = bundled.map((step) => ({
    id: step.id,
    stepType: mapStepType(step.step_type),
    refId: step.ref_id,
    title: step.title,
    position: step.position,
    gates: step.gates.map((gate) => ({
      id: gate.id,
      gateType: mapGateType(gate.gate_type),
      config: gate.config_json,
    })),
  }));

  const progressRows = enrolled
    ? await listPathStepProgress({
        tx,
        membershipId: ctx.actorMembershipId,
        stepIds,
      })
    : [];

  const progressByStep = new Map(progressRows.map((row) => [row.path_step_id, row]));
  const completedStepIds = new Set(
    progressRows.filter((row) => row.status === "completed").map((row) => row.path_step_id),
  );

  const progressSteps: PathProgressDto["steps"] = [];
  let completedStepCount = 0;
  let currentStepId: string | null = null;

  for (const step of steps) {
    const previousStep = steps.find((candidate) => candidate.position === step.position - 1);
    const previousStepCompleted = previousStep ? completedStepIds.has(previousStep.id) : true;

    const gateStates = await Promise.all(
      step.gates.map(async (gate) => {
        const assessmentId = readAssessmentIdFromGateConfig(gate.config, step.refId);
        const bandConfig = readCompetencyBandConfig(gate.config);

        let assessmentPassed = false;
        if (gate.gateType === "assessment_passed" && assessmentId) {
          assessmentPassed = await findPassedAssessmentAttempt({
            tx,
            membershipId: ctx.actorMembershipId,
            assessmentId,
          });
        }

        let competencyBandSatisfied = false;
        if (gate.gateType === "competency_band" && bandConfig.bandKey) {
          const currentBandKey = await findCompositeReadinessBand({
            tx,
            membershipId: ctx.actorMembershipId,
            scoringProfileId: bandConfig.scoringProfileId,
            compositeKey: bandConfig.compositeKey,
          });
          const currentRank = currentBandKey
            ? await findCompetencyBandRank({
                tx,
                bandKey: currentBandKey,
                scoringProfileId: bandConfig.scoringProfileId,
              })
            : null;
          const requiredRank = await findCompetencyBandRank({
            tx,
            bandKey: bandConfig.bandKey,
            scoringProfileId: bandConfig.scoringProfileId,
          });

          competencyBandSatisfied = compareBandKeys({
            currentBandKey,
            requiredBandKey: bandConfig.bandKey,
            currentRank,
            requiredRank,
          });
        }

        const existingProgress = progressByStep.get(step.id);
        const manualApproved =
          gate.gateType === "manual" && existingProgress?.status === "completed";

        const state = evaluateGateState(gate.gateType, {
          membershipId: ctx.actorMembershipId,
          stepId: step.id,
          stepPosition: step.position,
          stepRefId: step.refId,
          previousStepCompleted,
          assessmentPassed,
          competencyBandSatisfied,
          manualApproved,
        });

        return { gate, state };
      }),
    );

    const locked = !enrolled || stepLockedFromGates(gateStates.map((item) => item.state));
    const stored = progressByStep.get(step.id);
    const completed = stored?.status === "completed" || completedStepIds.has(step.id);
    const inProgress = stored?.status === "in_progress";

    const progressStatus = deriveProgressStatus({ locked, completed, inProgress });

    if (completed) {
      completedStepCount += 1;
    } else if (!locked && currentStepId == null) {
      currentStepId = step.id;
    }

    if (enrolled && !locked && !completed && progressStatus === "unlocked") {
      const prior = progressByStep.get(step.id);
      if (!prior || prior.status === "locked") {
        await upsertPathStepProgress({
          tx,
          tenantId: ctx.tenantId,
          stepId: step.id,
          membershipId: ctx.actorMembershipId,
          status: "unlocked",
        });
      }
    }

    if (enrolled && completed && !stored) {
      await upsertPathStepProgress({
        tx,
        tenantId: ctx.tenantId,
        stepId: step.id,
        membershipId: ctx.actorMembershipId,
        status: "completed",
        completedAt: new Date(),
      });

      await outbox.publish(tx, {
        ctx: {
          tenantId: ctx.tenantId,
          actorMembershipId: ctx.actorMembershipId,
          requestId: ctx.requestId,
        },
        eventType: "path.step_completed",
        aggregateType: "learning_path",
        aggregateId: pathId,
        payload: {
          pathId,
          stepId: step.id,
          membershipId: ctx.actorMembershipId,
          completedAt: new Date().toISOString(),
        },
        idempotencyKey: `${ctx.requestId}:path.step_completed:${pathId}:${step.id}`,
      });
    }

    progressSteps.push({
      stepId: step.id,
      position: step.position,
      title: step.title,
      stepType: step.stepType,
      refId: step.refId,
      progressStatus,
      locked,
      gates: gateStates.map(({ gate, state }) => ({
        id: gate.id,
        gateType: gate.gateType,
        state,
        config: gate.config,
      })),
      href: locked ? null : stepHref(step.stepType, step.refId),
    });
  }

  const nextAction = !enrolled
    ? { type: "enroll" as const, stepId: null, label: "Enroll to begin" }
    : completedStepCount === steps.length
      ? { type: "complete" as const, stepId: null, label: "Path complete" }
      : currentStepId
        ? {
            type: progressSteps.find((step) => step.stepId === currentStepId)?.locked
              ? ("wait_for_gate" as const)
              : ("continue" as const),
            stepId: currentStepId,
            label: progressSteps.find((step) => step.stepId === currentStepId)?.locked
              ? "Complete gate requirements"
              : "Continue next step",
          }
        : { type: "wait_for_gate" as const, stepId: null, label: "Complete gate requirements" };

  return {
    pathId,
    enrolled,
    enrollmentId,
    completedStepCount,
    totalStepCount: steps.length,
    currentStepId,
    nextAction,
    steps: progressSteps,
  };
}
