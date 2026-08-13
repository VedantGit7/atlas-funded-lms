import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateDetailResponseSchema,
  certificateLifecycleActionBodySchema,
} from "../../../../../../server/certificates/certificate.dto";
import { certificateParamsSchema } from "../../../../../../server/certificates/certificate.params";
import { reissueCertificate } from "../../../../../../server/certificates/certificate.service";
import { reissueCertificateMetadata } from "../../../../../../server/certificates/certificate.route-metadata";
import { scheduleCertificatePdfDrain } from "../../../../../../server/certificates/certificate-pdf-drain";

export const POST = createTenantRoute<
  z.output<typeof certificateLifecycleActionBodySchema>,
  z.output<typeof certificateDetailResponseSchema>,
  typeof certificateParamsSchema
>({
  metadata: reissueCertificateMetadata,
  params: certificateParamsSchema,
  body: certificateLifecycleActionBodySchema,
  output: certificateDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const result = await reissueCertificate(
      tx,
      ctx,
      params["id"],
      input,
      ctx.idempotencyKey ?? ctx.requestId,
    );
    scheduleCertificatePdfDrain({ tenantId: ctx.tenantId, requestId: ctx.requestId });
    return result;
  },
});
