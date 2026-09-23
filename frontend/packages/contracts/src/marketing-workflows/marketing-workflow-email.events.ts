import { z } from "zod";

export const MARKETING_WORKFLOW_EMAIL_REQUESTED_EVENT = "marketing.workflow_email_requested";
export const marketingWorkflowEmailPayloadSchema = z
  .object({
    runId: z.uuid(),
    nodeId: z.string().min(1).max(64),
    actionTitle: z.string().max(200),
    membershipId: z.uuid().nullable(),
    idempotencyKey: z.string().min(1).max(200),
    to: z.email(),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(100_000),
    fromName: z.string(),
    fromEmail: z.string(),
    replyToEmail: z.string().nullable(),
  })
  .strict();
