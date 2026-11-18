import { z } from "zod";
import { auditWriter } from "@atlas/audit";
import { systemServiceCtx } from "@atlas/core/actor/system-actor";
import { withTenantTx, type TenantTx } from "@atlas/db";
import { DATA_DELETION_PROCESSED_AUDIT } from "./data-rights.events";
import { dataRightsRepository } from "./data-rights.repository";
import {
  ERASURE_KEPT_CATEGORIES,
  ERASURE_NOT_COVERED,
  memberErasureOutcomeSchema,
  type MemberErasureOutcome,
} from "./privacy-lifecycle.contract";

/**
 * Carries out due deletion requests for one academy (launch plan 5.7,
 * docs/engineering/member-erasure.md):
 *
 * 1. app.erase_member() erases the member's database records in one
 *    transaction and returns the files left to delete.
 * 2. The files are deleted from storage.
 * 3. app.erase_member_account() deletes the global login if no other academy
 *    uses it.
 * 4. app.complete_member_erasure() records the outcome and marks the request
 *    SUCCEEDED, or keeps the files that failed for the next sweep.
 *
 * A failure after step 1 leaves the request RUNNING and the erasure logged;
 * the next sweep picks it up again from step 1, which then only reports what
 * it already did.
 */

/** Requests erased per academy per sweep; erasure is rare and each is a large transaction. */
export const MEMBER_ERASURE_BATCH_LIMIT = 3;

/** Errors app.erase_member() raises for a request that can never be carried out. */
const PERMANENT_ERASURE_FAILURES: Record<string, string> = {
  P0001: "ACADEMY_OWNER",
  P0002: "NOT_ERASABLE",
};

const pendingObjectSchema = z.object({ bucket: z.string().nullable(), key: z.string().min(1) });
const eraseResultSchema = z.object({
  erasureId: z.uuid(),
  principalId: z.uuid().nullable(),
  pendingObjects: z.array(pendingObjectSchema),
  alreadyErased: z.boolean(),
});
const erasureLogSchema = z.object({
  deleted: z.record(z.string(), z.number()).default({}),
  auditEntriesRedacted: z.number().default(0),
  eventsRedacted: z.number().default(0),
});

export type PendingObject = z.infer<typeof pendingObjectSchema>;

export type MemberErasureDeps = {
  /** Deletes one stored object; `bucket` null means the academy's default bucket. */
  deleteObject: (object: PendingObject) => Promise<void>;
};

/**
 * The PostgreSQL SQLSTATE of a raw query failure. With the pg driver adapter,
 * Prisma reports it as P2010 and puts the database's code under
 * meta.driverAdapterError.cause.
 */
function errorCode(error: unknown): string | null {
  const meta = (error as { meta?: Record<string, unknown> } | null)?.meta;
  const adapterCause = (meta?.["driverAdapterError"] as { cause?: { code?: unknown } } | undefined)
    ?.cause;
  if (typeof adapterCause?.code === "string") return adapterCause.code;
  return typeof meta?.["code"] === "string" ? meta["code"] : null;
}

export async function runDueMemberErasures(
  input: { tenantId: string; requestId: string },
  deps: MemberErasureDeps,
): Promise<number> {
  const txOptions = {
    tenantId: input.tenantId,
    requestId: input.requestId,
    allowAnonymousTenantRead: true as const,
  };
  const due = await withTenantTx(txOptions, (tx) =>
    dataRightsRepository.listDueDeletionRequests(tx, MEMBER_ERASURE_BATCH_LIMIT),
  );

  let erased = 0;
  for (const request of due) {
    // 1. The database records, in one transaction.
    let result: z.infer<typeof eraseResultSchema>;
    try {
      result = await withTenantTx(txOptions, async (tx) => {
        const rows = await tx.$queryRaw<Array<{ result: unknown }>>`
          select app.erase_member(
            ${input.tenantId}::uuid,
            ${request.target_id}::uuid,
            ${request.id}::uuid
          ) as result
        `;
        return eraseResultSchema.parse(rows[0]?.result);
      });
    } catch (error) {
      const permanent = PERMANENT_ERASURE_FAILURES[errorCode(error) ?? ""];
      if (!permanent) throw error;
      await withTenantTx(txOptions, async (tx) => {
        await dataRightsRepository.markDeletionRequestFailed(tx, request.id, permanent);
        await writeErasureAudit(tx, input, request.id, { status: "FAILED", error: permanent });
      });
      continue;
    }

    // 2. The files.
    const remaining: PendingObject[] = [];
    let filesDeleted = 0;
    for (const object of result.pendingObjects) {
      try {
        await deps.deleteObject(object);
        filesDeleted += 1;
      } catch {
        remaining.push(object);
      }
    }

    // 3. The login account, if no other academy uses it; 4. the outcome.
    await withTenantTx(txOptions, async (tx) => {
      let account: MemberErasureOutcome["account"] = "none";
      if (result.principalId) {
        const rows = await tx.$queryRaw<Array<{ deleted: boolean }>>`
          select app.erase_member_account(${result.erasureId}::uuid) as deleted
        `;
        account = rows[0]?.deleted ? "deleted" : "kept_for_other_academies";
      }
      const logRows = await tx.$queryRaw<Array<{ outcome_json: unknown }>>`
        select outcome_json from member_erasures where id = ${result.erasureId}::uuid
      `;
      const log = erasureLogSchema.parse(logRows[0]?.outcome_json ?? {});
      const outcome = memberErasureOutcomeSchema.parse({
        version: 2,
        operation: "erase_member",
        erasedAt: new Date().toISOString(),
        deleted: log.deleted,
        auditEntriesRedacted: log.auditEntriesRedacted,
        eventsRedacted: log.eventsRedacted,
        files: { deleted: filesDeleted, failed: remaining.length },
        account,
        kept: [...ERASURE_KEPT_CATEGORIES],
        notCovered: [...ERASURE_NOT_COVERED],
      });
      await tx.$executeRaw`
        select app.complete_member_erasure(
          ${result.erasureId}::uuid,
          ${JSON.stringify(remaining)}::jsonb,
          ${JSON.stringify(outcome)}::jsonb
        )
      `;
      if (remaining.length === 0) {
        await writeErasureAudit(tx, input, request.id, {
          status: "SUCCEEDED",
          account,
          filesDeleted,
          auditEntriesRedacted: log.auditEntriesRedacted,
        });
      }
    });
    if (remaining.length === 0) erased += 1;
  }
  return erased;
}

async function writeErasureAudit(
  tx: TenantTx,
  input: { tenantId: string; requestId: string },
  deletionRequestId: string,
  after: Record<string, unknown>,
): Promise<void> {
  await auditWriter.write(
    tx,
    {
      ...systemServiceCtx({
        tenantId: input.tenantId,
        requestId: input.requestId,
        source: "data_rights.member_erasure",
      }),
      platformPrincipalId: null,
    },
    {
      action: DATA_DELETION_PROCESSED_AUDIT,
      target: { type: "deletion_request", id: deletionRequestId },
      before: null,
      after,
      reason: null,
      metadata: {},
    },
  );
}
