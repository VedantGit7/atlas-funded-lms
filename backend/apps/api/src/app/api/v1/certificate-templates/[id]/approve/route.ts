import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateTemplateDetailResponseSchema,
  publishCertificateTemplateBodySchema,
} from "../../../../../../server/certificates/certificate.dto";
import { certificateTemplateParamsSchema } from "../../../../../../server/certificates/certificate.params";
import { approveCertificateTemplate } from "../../../../../../server/certificates/certificate.service";
import { approveCertificateTemplateMetadata } from "../../../../../../server/certificates/certificate.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof publishCertificateTemplateBodySchema>,
  z.output<typeof certificateTemplateDetailResponseSchema>,
  typeof certificateTemplateParamsSchema
>({
  metadata: approveCertificateTemplateMetadata,
  params: certificateTemplateParamsSchema,
  body: publishCertificateTemplateBodySchema,
  output: certificateTemplateDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    approveCertificateTemplate(tx, ctx, params["id"] ?? "", input),
});
