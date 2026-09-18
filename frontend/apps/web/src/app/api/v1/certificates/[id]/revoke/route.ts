import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateDetailResponseSchema,
  certificateRevokeBodySchema,
} from "../../../../../../server/certificates/certificate.dto";
import { certificateParamsSchema } from "../../../../../../server/certificates/certificate.params";
import { revokeCertificate } from "../../../../../../server/certificates/certificate.service";
import { revokeCertificateMetadata } from "../../../../../../server/certificates/certificate.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof certificateRevokeBodySchema>,
  z.output<typeof certificateDetailResponseSchema>,
  typeof certificateParamsSchema
>({
  metadata: revokeCertificateMetadata,
  params: certificateParamsSchema,
  body: certificateRevokeBodySchema,
  output: certificateDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => revokeCertificate(tx, ctx, params.id, input),
});
