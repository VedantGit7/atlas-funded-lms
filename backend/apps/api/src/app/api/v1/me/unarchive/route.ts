import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { findOwnArchiveStatus, unarchiveOwnMembership } from "@atlas/membership";
import { recordAuditChange } from "@atlas/api-server/audit-change";
import { archiveMutationMetadata } from "../archive/route.metadata";

const unarchiveResponseSchema = z.object({
  data: z.object({ archivedAt: z.iso.datetime().nullable() }),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof unarchiveResponseSchema>
>({
  metadata: archiveMutationMetadata,
  output: unarchiveResponseSchema,
  handler: async ({ tx, ctx }) => {
    const before = await findOwnArchiveStatus({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
    });
    const result = await unarchiveOwnMembership({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
    });
    await recordAuditChange(tx, ctx, {
      action: "membership.self_unarchived",
      target: { type: "membership", id: ctx.actorMembershipId },
      before,
      after: result,
    });
    return { data: result };
  },
});
