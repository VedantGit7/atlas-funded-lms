import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { certificateWalletPassResponseSchema } from "../../../../../../../server/certificates/certificate.dto";
import { certificateParamsSchema } from "../../../../../../../server/certificates/certificate.params";
import { issueAppleWalletPass } from "../../../../../../../server/certificates/certificate-wallet.service";
import { certificateWalletPassMetadata } from "../../../../../../../server/certificates/certificate.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof certificateWalletPassResponseSchema>,
  typeof certificateParamsSchema
>({
  metadata: certificateWalletPassMetadata,
  params: certificateParamsSchema,
  output: certificateWalletPassResponseSchema,
  handler: async ({ tx, ctx, params }) => issueAppleWalletPass(tx, ctx, params.id),
});
