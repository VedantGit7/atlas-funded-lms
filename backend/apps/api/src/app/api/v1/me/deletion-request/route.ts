import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { myDeletionRequestStatusResponseSchema } from "@atlas/domain/data-rights/data-rights.dto";
import { getMyDeletionRequestStatus } from "@atlas/domain/data-rights/data-rights.service";
import { getMyDeletionRequestStatusMetadata } from "@atlas/domain/data-rights/data-rights.route-metadata";

type MyDeletionRequestStatusResponse = z.output<typeof myDeletionRequestStatusResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, MyDeletionRequestStatusResponse>({
  metadata: getMyDeletionRequestStatusMetadata,
  output: myDeletionRequestStatusResponseSchema,
  handler: async ({ tx, ctx }) => getMyDeletionRequestStatus(tx, ctx),
});
