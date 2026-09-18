import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { ProvisioningJobListResponseSchema } from "@atlas/domain-tenancy/schemas/platform-tenants";
import { readTenantProvisioningJobs } from "@atlas/domain-tenancy";
import { routeMetadata } from "./route.metadata";

type ProvisioningJobListResponse = z.output<typeof ProvisioningJobListResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, ProvisioningJobListResponse>({
  metadata: routeMetadata,
  output: ProvisioningJobListResponseSchema,
  handler: async ({ tx, ctx }) => readTenantProvisioningJobs(tx, ctx.tenantId),
});
