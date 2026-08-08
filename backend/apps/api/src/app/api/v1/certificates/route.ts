import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateListQuerySchema,
  certificateListResponseSchema,
} from "../../../../server/certificates/certificate.dto";
import { listCertificates } from "../../../../server/certificates/certificate.service";
import { listCertificatesMetadata } from "../../../../server/certificates/certificate.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof certificateListQuerySchema>,
  z.output<typeof certificateListResponseSchema>
>({
  metadata: listCertificatesMetadata,
  input: certificateListQuerySchema,
  output: certificateListResponseSchema,
  handler: async ({ tx, ctx, input }) => listCertificates(tx, ctx, input),
});
