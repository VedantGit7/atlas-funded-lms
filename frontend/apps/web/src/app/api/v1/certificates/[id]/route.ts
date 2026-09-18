import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { certificateDetailResponseSchema } from "../../../../../server/certificates/certificate.dto";
import { certificateParamsSchema } from "../../../../../server/certificates/certificate.params";
import { getCertificate } from "../../../../../server/certificates/certificate.service";
import { getCertificateMetadata } from "../../../../../server/certificates/certificate.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof certificateDetailResponseSchema>,
  typeof certificateParamsSchema
>({
  metadata: getCertificateMetadata,
  params: certificateParamsSchema,
  output: certificateDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getCertificate(tx, ctx, params.id),
});
