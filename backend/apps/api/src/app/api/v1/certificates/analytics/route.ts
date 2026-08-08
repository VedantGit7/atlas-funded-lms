import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { certificateAnalyticsResponseSchema } from "../../../../../server/certificates/certificate.dto";
import { getCertificateAnalytics } from "../../../../../server/certificates/certificate.service";
import { certificateAnalyticsMetadata } from "../../../../../server/certificates/certificate.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof certificateAnalyticsResponseSchema>
>({
  metadata: certificateAnalyticsMetadata,
  output: certificateAnalyticsResponseSchema,
  handler: async ({ tx, ctx }) => getCertificateAnalytics(tx, ctx),
});
