import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { archiveOwnMembership, findOwnArchiveStatus } from "@atlas/membership";
import { recordAuditChange } from "@atlas/api-server/audit-change";
import { archiveMutationMetadata, archiveReadMetadata } from "./route.metadata";

const archiveResponseSchema = z.object({
  data: z.object({ archivedAt: z.iso.datetime().nullable() }),
});

export const GET = createTenantRoute<Record<string, never>, z.output<typeof archiveResponseSchema>>(
  {
    metadata: archiveReadMetadata,
    output: archiveResponseSchema,
    handler: async ({ tx, ctx }) => {
      const result = await findOwnArchiveStatus({
        tx,
        tenantId: ctx.tenantId,
        membershipId: ctx.actorMembershipId,
      });
      return { data: result };
    },
  },
);

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof archiveResponseSchema>
>({
  metadata: archiveMutationMetadata,
  output: archiveResponseSchema,
  handler: async ({ tx, ctx }) => {
    const before = await findOwnArchiveStatus({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
    });
    const result = await archiveOwnMembership({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
    });
    await recordAuditChange(tx, ctx, {
      action: "membership.self_archived",
      target: { type: "membership", id: ctx.actorMembershipId },
      before,
      after: result,
    });
    return { data: result };
  },
});
