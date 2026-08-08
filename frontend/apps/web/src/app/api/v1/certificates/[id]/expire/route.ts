import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  certificateDetailResponseSchema,
  certificateLifecycleActionBodySchema,
} from "../../../../../../server/certificates/certificate.dto";
import { certificateParamsSchema } from "../../../../../../server/certificates/certificate.params";
import { expireCertificate } from "../../../../../../server/certificates/certificate.service";
import { certificateLifecycleMetadata } from "../../../../../../server/certificates/certificate.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof certificateLifecycleActionBodySchema>,
  z.output<typeof certificateDetailResponseSchema>,
  typeof certificateParamsSchema
>({
  metadata: certificateLifecycleMetadata,
  params: certificateParamsSchema,
  body: certificateLifecycleActionBodySchema,
  output: certificateDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    expireCertificate(tx, ctx, params["id"] ?? "", input),
});
