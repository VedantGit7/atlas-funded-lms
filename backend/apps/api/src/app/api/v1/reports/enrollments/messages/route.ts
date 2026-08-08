import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  sendEnrollmentMessageBodySchema,
  sendEnrollmentMessageResponseSchema,
} from "@atlas/domain/reports/enrollments-roster.dto";
import { sendEnrollmentMessageMetadata } from "@atlas/domain/reports/enrollments-roster.route-metadata";
import { sendEnrollmentRosterMessage } from "../../../../../../server/reports/enrollments-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof sendEnrollmentMessageBodySchema>,
  z.output<typeof sendEnrollmentMessageResponseSchema>
>({
  metadata: sendEnrollmentMessageMetadata,
  body: sendEnrollmentMessageBodySchema,
  output: sendEnrollmentMessageResponseSchema,
  handler: async ({ tx, ctx, input }) => sendEnrollmentRosterMessage(tx, ctx, input),
});
