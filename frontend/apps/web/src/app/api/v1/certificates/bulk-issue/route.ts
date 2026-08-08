import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateBulkIssueBodySchema,
  certificateBulkIssueResponseSchema,
} from "../../../../../server/certificates/certificate.dto";
import { bulkIssueCertificates } from "../../../../../server/certificates/certificate.service";
import { bulkIssueCertificateMetadata } from "../../../../../server/certificates/certificate.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof certificateBulkIssueBodySchema>,
  z.output<typeof certificateBulkIssueResponseSchema>
>({
  metadata: bulkIssueCertificateMetadata,
  body: certificateBulkIssueBodySchema,
  output: certificateBulkIssueResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    bulkIssueCertificates(tx, ctx, input, ctx.idempotencyKey ?? ctx.requestId),
});
