import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listZoomMeetingsResponseSchema } from "@atlas/domain/zoom/zoom.dto";
import { listZoomMeetingsMetadata } from "@atlas/domain/zoom/zoom.route-metadata";
import { listZoomMeetings } from "@atlas/domain/zoom/zoom.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof listZoomMeetingsResponseSchema>
>({
  metadata: listZoomMeetingsMetadata,
  output: listZoomMeetingsResponseSchema,
  handler: async ({ tx, ctx }) => listZoomMeetings(tx, ctx),
});
