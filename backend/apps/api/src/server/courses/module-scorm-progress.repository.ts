import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

type Tx = TenantTx;

export type ModuleScormProgressRow = {
  id: string;
  status: string;
  progressPct: number;
  cmiJson: Record<string, unknown> | null;
  completedAt: Date | null;
  lastSeenAt: Date | null;
};

export async function findModuleScormProgress(args: {
  tx: Tx;
  moduleId: string;
  membershipId: string;
}): Promise<ModuleScormProgressRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      status: string;
      progress_pct: number;
      cmi_json: Record<string, unknown> | null;
      completed_at: Date | null;
      last_seen_at: Date | null;
    }>
  >`
    select
      id::text,
      status,
      progress_pct,
      cmi_json,
      completed_at,
      last_seen_at
    from module_scorm_progress
    where module_id = ${args.moduleId}::uuid
      and membership_id = ${args.membershipId}::uuid
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    progressPct: row.progress_pct,
    cmiJson: row.cmi_json,
    completedAt: row.completed_at,
    lastSeenAt: row.last_seen_at,
  };
}

/**
 * The learner's row, created if missing and locked for this transaction.
 *
 * Commits read, merge and write the whole CMI document, so two tabs (or two
 * documents of one launch) committing together must take turns; and two first
 * commits must not both try to insert.
 */
export async function lockModuleScormProgress(args: {
  tx: Tx;
  tenantId: string;
  moduleId: string;
  membershipId: string;
}): Promise<ModuleScormProgressRow> {
  await args.tx.$executeRaw`
    insert into module_scorm_progress (
      id, tenant_id, module_id, membership_id, status, progress_pct, cmi_json, last_seen_at, updated_at
    )
    values (
      ${randomUUID()}::uuid, ${args.tenantId}::uuid, ${args.moduleId}::uuid, ${args.membershipId}::uuid,
      'not_started', 0, null, now(), now()
    )
    on conflict (tenant_id, module_id, membership_id) do nothing
  `;
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      status: string;
      progress_pct: number;
      cmi_json: Record<string, unknown> | null;
      completed_at: Date | null;
      last_seen_at: Date | null;
    }>
  >`
    select id::text, status, progress_pct, cmi_json, completed_at, last_seen_at
    from module_scorm_progress
    where tenant_id = ${args.tenantId}::uuid
      and module_id = ${args.moduleId}::uuid
      and membership_id = ${args.membershipId}::uuid
    for update
  `;
  const row = rows[0];
  if (!row) throw new Error("SCORM progress row missing after insert");
  return {
    id: row.id,
    status: row.status,
    progressPct: row.progress_pct,
    cmiJson: row.cmi_json,
    completedAt: row.completed_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function upsertModuleScormProgress(args: {
  tx: Tx;
  tenantId: string;
  moduleId: string;
  membershipId: string;
  status: string;
  progressPct: number;
  cmiJson: Record<string, unknown> | null;
  completedAt: Date | null;
}): Promise<ModuleScormProgressRow> {
  const existing = await findModuleScormProgress({
    tx: args.tx,
    moduleId: args.moduleId,
    membershipId: args.membershipId,
  });

  if (existing) {
    await args.tx.$executeRaw`
      update module_scorm_progress
      set
        status = ${args.status},
        progress_pct = ${args.progressPct},
        cmi_json = ${args.cmiJson ? JSON.stringify(args.cmiJson) : null}::jsonb,
        completed_at = ${args.completedAt},
        last_seen_at = now(),
        updated_at = now()
      where id = ${existing.id}::uuid
    `;
  } else {
    const id = randomUUID();
    await args.tx.$executeRaw`
      insert into module_scorm_progress (
        id,
        tenant_id,
        module_id,
        membership_id,
        status,
        progress_pct,
        cmi_json,
        completed_at,
        last_seen_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.moduleId}::uuid,
        ${args.membershipId}::uuid,
        ${args.status},
        ${args.progressPct},
        ${args.cmiJson ? JSON.stringify(args.cmiJson) : null}::jsonb,
        ${args.completedAt},
        now(),
        now()
      )
    `;
  }

  const saved = await findModuleScormProgress({
    tx: args.tx,
    moduleId: args.moduleId,
    membershipId: args.membershipId,
  });

  if (!saved) {
    throw new Error("MODULE_SCORM_PROGRESS_SAVE_FAILED");
  }

  return saved;
}
