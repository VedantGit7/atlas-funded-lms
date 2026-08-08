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

export const PreviewInvitationQuerySchema = z
  .object({
    token: z.string().min(20).max(500),
  })
  .strict();

export const PreviewInvitationResponseSchema = z.object({
  data: z.object({
    invitedEmail: z.string().email(),
  }),
});

export const SetInvitationPasswordRequestSchema = z
  .object({
    token: z.string().min(20).max(500),
    password: z.string().min(8).max(200),
    accessToken: z.string().min(1).max(4000),
    refreshToken: z.string().max(4000).optional(),
  })
  .strict();

export const SetInvitationPasswordResponseSchema = z.object({
  data: z.object({
    status: z.literal("ACCEPTED"),
    redirectTo: z.string().nullable(),
  }),
});
