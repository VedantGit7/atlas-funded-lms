import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { connectZoomBodySchema, connectZoomResponseSchema } from "@atlas/domain/zoom/zoom.dto";
import { connectZoomMetadata } from "@atlas/domain/zoom/zoom.route-metadata";
import { connectZoom } from "@atlas/domain/zoom/zoom.service";

export const POST = createTenantRoute<
  z.output<typeof connectZoomBodySchema>,
  z.output<typeof connectZoomResponseSchema>
>({
  metadata: connectZoomMetadata,
  input: connectZoomBodySchema,
  output: connectZoomResponseSchema,
  handler: async ({ tx, ctx, input }) => connectZoom(tx, ctx, input),
});
