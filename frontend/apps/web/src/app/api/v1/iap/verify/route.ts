import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { verifyIapBodySchema, verifyIapResponseSchema } from "@atlas/domain/iap/iap.dto";
import { verifyIapMetadata } from "@atlas/domain/iap/iap.route-metadata";
import { verifyIapAndUnlock } from "@atlas/domain/iap/iap.service";

export const POST = createTenantRoute<
  z.output<typeof verifyIapBodySchema>,
  z.output<typeof verifyIapResponseSchema>
>({
  metadata: verifyIapMetadata,
  body: verifyIapBodySchema,
  output: verifyIapResponseSchema,
  handler: async ({ tx, ctx, input }) => verifyIapAndUnlock(tx, ctx, input),
});
