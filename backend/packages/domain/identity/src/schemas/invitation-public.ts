import { z } from "zod";
import { NEW_PASSWORD_MIN_LENGTH } from "./public-auth";

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
    invitedEmail: z.email(),
    /** Who is signed in on this browser, so the page can spot the wrong account. */
    signedInEmail: z.email().nullable().optional(),
    /**
     * Better Auth (launch plan task 3.6): whether the invited address already
     * has a way to sign in. "none" lets the page set a password straight away;
     * "exists" asks the person to sign in. Absent with Supabase, whose
     * invitation link carries its own session.
     */
    account: z.enum(["none", "exists"]).optional(),
  }),
});

export const SetInvitationPasswordRequestSchema = z
  .object({
    token: z.string().min(20).max(500),
    password: z.string().min(NEW_PASSWORD_MIN_LENGTH).max(200),
    /** Supabase: the session from the invitation link. Absent with Better Auth. */
    accessToken: z.string().min(1).max(4000).optional(),
    refreshToken: z.string().max(4000).optional(),
  })
  .strict();

export const SetInvitationPasswordResponseSchema = z.object({
  data: z.object({
    status: z.literal("ACCEPTED"),
    redirectTo: z.string().nullable(),
  }),
});
