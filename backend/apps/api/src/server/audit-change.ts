import { auditWriter } from "@atlas/audit";
import type { TenantTx } from "@atlas/db";

type MemberCtx = { tenantId: string; actorMembershipId: string; requestId: string };

const VOLATILE_FIELDS = new Set(["updatedAt", "updated_at"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** Top-level fields whose value differs, ignoring update timestamps. */
export function changedFields(before: unknown, after: unknown): string[] {
  if (!isPlainObject(before) || !isPlainObject(after)) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(
    (key) =>
      !VOLATILE_FIELDS.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

/**
 * Record a member's change to a tenant record: what it was, what it is now,
 * and which fields changed (`metadata.changedFields` when both sides are
 * objects). The common case behind `audit: "required"` routes (audit M7).
 */
export async function recordAuditChange(
  tx: TenantTx,
  ctx: MemberCtx,
  input: {
    action: string;
    target: { type: string; id: string | null };
    before: unknown;
    after: unknown;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const changed = changedFields(input.before, input.after);
  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: input.action,
      target: input.target,
      before: input.before ?? null,
      after: input.after ?? null,
      reason: input.reason ?? null,
      metadata: {
        ...(changed.length > 0 ? { changedFields: changed } : {}),
        ...input.metadata,
      },
    },
  );
}
