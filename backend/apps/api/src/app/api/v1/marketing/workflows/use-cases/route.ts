import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { marketingUseCasesResponseSchema } from "../../../../../../server/marketing-workflows/marketing-workflow.schemas";
import { listMarketingWorkflowsMetadata } from "../../../../../../server/marketing-workflows/marketing-workflow.route-metadata";
import { listMarketingUseCases } from "../../../../../../server/marketing-workflows/marketing-workflow.service";

export const GET = createTenantRoute<
  undefined,
  z.output<typeof marketingUseCasesResponseSchema>
>({
  metadata: listMarketingWorkflowsMetadata,
  output: marketingUseCasesResponseSchema,
  handler: async ({ tx, ctx }) => listMarketingUseCases(tx, ctx),
});
