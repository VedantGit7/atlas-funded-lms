import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { adminOverviewResponseSchema } from "../../../../../server/admin/admin-overview.contract";
import { getAdminOverview } from "../../../../../server/admin/admin-overview.service";
import { getRouteMetadata } from "./route.metadata";

type AdminOverviewResponse = z.output<typeof adminOverviewResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, AdminOverviewResponse>({
  metadata: getRouteMetadata,
  input: noBodySchema,
  output: adminOverviewResponseSchema,
  handler: async ({ tx, ctx }) => getAdminOverview(tx, ctx),
});
