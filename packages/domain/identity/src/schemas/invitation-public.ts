import { z } from "zod";

export const invitationAcceptStatusSchema = z.enum([
  "ACCEPTED",
  "LOGIN_REQUIRED",
  "SIGNUP_REQUIRED",
]);

export type InvitationAcceptStatus = z.infer<typeof invitationAcceptStatusSchema>;

export const AcceptInvitationRequestSchema = z
  .object({
    token: z.string().min(20).max(500),
  })
  .strict();

export const AcceptInvitationResponseSchema = z.object({
  data: z.object({
    status: invitationAcceptStatusSchema,
    redirectTo: z.string().nullable(),
  }),
});
