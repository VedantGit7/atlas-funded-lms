import type { NextRequest } from "next/server";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  PlatformTenantParamsSchema,
  ProvisioningJobListResponseSchema,
} from "@atlas/domain-tenancy/schemas/platform-tenants";
import { readTenantProvisioningJobs } from "@atlas/domain-tenancy";
import { routeMetadata } from "./route.metadata";

const getProvisioningJobs = createPlatformRoute({
  metadata: routeMetadata,
  params: PlatformTenantParamsSchema,
  output: ProvisioningJobListResponseSchema,
  handler: async ({ tx, params }) => {
    return readTenantProvisioningJobs(tx, params.id);
  },
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getProvisioningJobs(req, context);
}
