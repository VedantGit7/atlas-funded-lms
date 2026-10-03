import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { attemptsRepository } from "./attempts.repository";
import { ATTEMPT_DEADLINE_GRACE_MS, finalizeExpiredAttempt } from "./attempts.service";

export type AttemptDeadlineSweepResult = {
  finalized: number;
  failed: number;
  /** First failure message, for the worker's sweep error. */
  firstError: string | null;
};

/**
 * Finalizes one tenant's in-progress attempts whose deadline and grace window have passed.
 *
 * Audit finding H1: nothing ever closed an attempt whose learner closed the tab, lost
 * connectivity, or whose auto-submit was rejected, so it stayed STARTED forever with its saved
 * answers ungraded while still counting against the attempt limit. The outbox worker runs this on
 * every sweep.
 *
 * Each attempt is finalized in its own transaction, so one that cannot be graded (for example,
 * its assessment was deleted) is reported without rolling back the others.
 */
export async function finalizeExpiredAttemptsForTenant(args: {
  tenantId: string;
  requestId: string;
  limit: number;
}): Promise<AttemptDeadlineSweepResult> {
  const txCtx = {
    tenantId: args.tenantId,
    requestId: args.requestId,
    allowAnonymousTenantRead: true,
  };

  const attemptIds = await withTenantTx(txCtx, (tx) =>
    attemptsRepository.listExpiredStartedAttemptIds(tx, {
      graceMs: ATTEMPT_DEADLINE_GRACE_MS,
      limit: args.limit,
    }),
  );

  const result: AttemptDeadlineSweepResult = { finalized: 0, failed: 0, firstError: null };

  for (const attemptId of attemptIds) {
    try {
      const finalized = await withTenantTx(txCtx, (tx) =>
        finalizeExpiredAttempt(
          tx,
          { tenantId: args.tenantId, requestId: `${args.requestId}:${attemptId}` },
          attemptId,
        ),
      );
      if (finalized) result.finalized += 1;
    } catch (error) {
      result.failed += 1;
      result.firstError ??= `${attemptId}: ${
        error instanceof Error ? error.message.slice(0, 300) : String(error)
      }`;
    }
  }

  return result;
}
