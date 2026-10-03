import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  destinationParamsSchema,
  testDestinationResponseSchema,
} from "@atlas/domain/reports/destinations-roster.dto";
import { testDestinationMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { testDestination } from "@atlas/domain/reports/destinations-roster.service";
import { rejectClientTenantFields } from "@atlas/domain/shared/domain.dto";
import { getEmailProvider } from "../../../../../../../../server/notifications/notification.email-provider";

const emptyBodySchema = rejectClientTenantFields.extend({}).strict();

export const POST = createTenantRoute<
  z.output<typeof emptyBodySchema>,
  z.output<typeof testDestinationResponseSchema>,
  typeof destinationParamsSchema
>({
  metadata: testDestinationMetadata,
  params: destinationParamsSchema,
  input: emptyBodySchema,
  output: testDestinationResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const emailProvider = getEmailProvider();
    return testDestination(tx, ctx, params["destinationId"], {
      sendEmail: emailProvider.isConfigured()
        ? async (input: { to: string; subject: string; body: string; requestId: string }) => {
            await emailProvider.send({ ...input, tenantId: ctx.tenantId });
          }
        : null,
    });
  },
});
