import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { TenantConfigVersionsResponseSchema } from "@atlas/domain-config/schemas/tenant-config";
import { readTenantConfigVersions } from "@atlas/domain-config";
import { routeMetadata } from "./route.metadata";

type TenantConfigVersionsResponse = z.output<typeof TenantConfigVersionsResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, TenantConfigVersionsResponse>({
  metadata: routeMetadata,
  input: noBodySchema,
  output: TenantConfigVersionsResponseSchema,
  handler: async ({ tx }) => readTenantConfigVersions(tx),
});
