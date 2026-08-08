import { createTenantRoute, noBodySchema } from "@atlas/api";
import { z } from "zod";
import { runUsageSnapshot } from "@atlas/domain-config/services/usage.service";
import { routeMetadata } from "./route.metadata";

const ResponseSchema = z.object({ data: z.object({ ok: z.literal(true) }) });

export const POST = createTenantRoute({
  metadata: routeMetadata,
  input: noBodySchema,
  output: ResponseSchema,
  handler: async ({ tx }) => {
    await runUsageSnapshot(tx);
    return { data: { ok: true as const } };
  },
});
