import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { unarchiveOwnMembership } from "@atlas/membership";
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
    const result = await unarchiveOwnMembership({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
    });
    return { data: result };
  },
});
