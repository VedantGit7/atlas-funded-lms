import type { NextRequest } from "next/server";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  PlatformTenantParamsSchema,
  PlatformTenantDetailResponseSchema,
} from "@atlas/domain-tenancy/schemas/platform-tenants";
import { readPlatformTenantDetail } from "@atlas/domain-tenancy";
import { routeMetadata } from "./route.metadata";

const getTenantDetail = createPlatformRoute({
  metadata: routeMetadata,
  params: PlatformTenantParamsSchema,
  output: PlatformTenantDetailResponseSchema,
  handler: async ({ tx, params }) => {
    return readPlatformTenantDetail(tx, params.id);
  },
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getTenantDetail(req, context);
}
