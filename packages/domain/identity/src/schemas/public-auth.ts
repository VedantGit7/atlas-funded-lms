import { z } from "zod";

export const publicAuthStatusSchema = z.enum([
  "AUTHENTICATED",
  "EMAIL_VERIFICATION_REQUIRED",
  "MFA_REQUIRED",
  "NO_ACTIVE_MEMBERSHIP",
  "INVITED_MEMBERSHIP",
]);

export type PublicAuthStatus = z.infer<typeof publicAuthStatusSchema>;

export const PublicLoginRequestSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((value) => value.trim().toLowerCase()),
    password: z.string().min(8).max(200),
    redirectTo: z.string().max(300).optional(),
  })
  .strict();

export const PublicSignupRequestSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((value) => value.trim().toLowerCase()),
    password: z.string().min(8).max(200),
    displayName: z.string().trim().min(2).max(120),
    inviteToken: z.string().min(20).max(500).optional(),
  })
  .strict();

export const PublicAuthResponseSchema = z.object({
  data: z.object({
    status: publicAuthStatusSchema,
    redirectTo: z.string().nullable(),
  }),
});
