import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  sendCustomFieldMessageBodySchema,
  sendCustomFieldMessageResponseSchema,
} from "@atlas/domain/reports/custom-field-roster.dto";
import { mutateCustomFieldRosterMetadata } from "@atlas/domain/reports/custom-field-roster.route-metadata";
import { sendCustomFieldRosterMessage } from "../../../../../../../server/reports/custom-field-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof sendCustomFieldMessageBodySchema>,
  z.output<typeof sendCustomFieldMessageResponseSchema>
>({
  metadata: mutateCustomFieldRosterMetadata,
  body: sendCustomFieldMessageBodySchema,
  output: sendCustomFieldMessageResponseSchema,
  handler: async ({ tx, ctx, input }) => sendCustomFieldRosterMessage(tx, ctx, input),
});
