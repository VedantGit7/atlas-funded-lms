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
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(8).max(200),
    redirectTo: z.string().max(300).optional(),
    rememberMe: z.boolean().optional(),
  })
  .strict();

export const PublicOAuthProviderSchema = z.enum(["google", "apple"]);

export type PublicOAuthProvider = z.infer<typeof PublicOAuthProviderSchema>;

export const PublicOAuthStartRequestSchema = z
  .object({
    provider: PublicOAuthProviderSchema,
    rememberMe: z.boolean().optional(),
  })
  .strict();

/** Google's address. Better Auth keeps its verifier and sets a signed state cookie. */
export const PublicOAuthStartResponseSchema = z.object({
  data: z.object({
    url: z.url(),
  }),
});

export const PublicOAuthCallbackRequestSchema = z
  .object({
    code: z.string().min(1).max(4000),
    /** Google's state parameter, checked against Better Auth's signed cookie. */
    state: z.string().min(1).max(500),
    redirectTo: z.string().max(300).optional(),
    rememberMe: z.boolean().optional(),
  })
  .strict();

/**
 * Minimum length for a password being set (audit H6). Sign-in schemas keep the
 * older minimum so existing passwords still work until they are changed. Must
 * match NEW_PASSWORD_MIN_LENGTH in @atlas/auth/password-policy.
 */
export const NEW_PASSWORD_MIN_LENGTH = 10;

export const PublicSignupRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(NEW_PASSWORD_MIN_LENGTH).max(200),
    displayName: z.string().trim().min(2).max(120),
    inviteToken: z.string().min(20).max(500).optional(),
    /** Optional Learnyst-style referral / invite code (not an admin invite token). */
    referralCode: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z
        .string()
        .trim()
        .min(4)
        .max(32)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
    ),
  })
  .strict();

// What an email link is for, as the confirm page passes it on with the link's
// single-use token.
export const PublicEmailOtpTypeSchema = z.enum([
  "signup",
  "email",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
]);

export type PublicEmailOtpType = z.infer<typeof PublicEmailOtpTypeSchema>;

export const PublicAuthConfirmRequestSchema = z
  .object({
    // The single-use token from the email link, verified by the server. The
    // session itself never travels through the URL.
    tokenHash: z.string().min(1).max(4000),
    type: PublicEmailOtpTypeSchema,
  })
  .strict();

export const PublicAuthResendRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
  })
  .strict();

export const PublicAuthResponseSchema = z.object({
  data: z.object({
    status: publicAuthStatusSchema,
    redirectTo: z.string().nullable(),
  }),
});

export const PublicMfaVerifyRequestSchema = z
  .object({
    code: z.string().trim().min(6).max(12),
  })
  .strict();

export const PublicPasswordResetRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
  })
  .strict();

export const PublicPasswordResetCompleteSchema = z
  .object({
    password: z.string().min(NEW_PASSWORD_MIN_LENGTH).max(200),
    /** The single-use token in the reset link (launch plan task 3.2). */
    token: z.string().min(1).max(512),
  })
  .strict();

/**
 * RESET: the password changed. Every session ends with it, and an account with
 * an authenticator still needs its code to sign in again.
 */
export const PublicPasswordResetCompleteResponseSchema = z.object({
  data: z.object({
    status: z.literal("RESET"),
  }),
});

export type PublicPasswordResetCompleteResponse = z.infer<
  typeof PublicPasswordResetCompleteResponseSchema
>;
