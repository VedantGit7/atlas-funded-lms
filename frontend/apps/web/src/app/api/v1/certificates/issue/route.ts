import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateDetailResponseSchema,
  certificateIssueBodySchema,
} from "../../../../../server/certificates/certificate.dto";
import { issueCertificate } from "../../../../../server/certificates/certificate.service";
import { issueCertificateMetadata } from "../../../../../server/certificates/certificate.route-metadata";
import { scheduleCertificatePdfDrain } from "../../../../../server/certificates/certificate-pdf-drain";

export const POST = createTenantRoute<
  z.output<typeof certificateIssueBodySchema>,
  z.output<typeof certificateDetailResponseSchema>
>({
  metadata: issueCertificateMetadata,
  body: certificateIssueBodySchema,
  output: certificateDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const result = await issueCertificate(tx, ctx, input, ctx.idempotencyKey ?? ctx.requestId);
    scheduleCertificatePdfDrain({ tenantId: ctx.tenantId, requestId: ctx.requestId });
    return result;
  },
});
