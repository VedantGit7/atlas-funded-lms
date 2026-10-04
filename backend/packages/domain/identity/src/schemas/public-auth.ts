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
    redirectTo: z.url().max(500),
    rememberMe: z.boolean().optional(),
  })
  .strict();

export const PublicOAuthStartResponseSchema = z.object({
  data: z.object({
    url: z.url(),
    codeVerifier: z.string().min(1),
  }),
});

export const PublicOAuthCallbackRequestSchema = z
  .object({
    code: z.string().min(1).max(4000),
    codeVerifier: z.string().min(1).max(4000),
    redirectTo: z.string().max(300).optional(),
    rememberMe: z.boolean().optional(),
  })
  .strict();

/**
 * Minimum length for a password being set (audit H6). Sign-in schemas keep the
 * older minimum so existing passwords still work until they are changed. Must
 * match NEW_PASSWORD_MIN_LENGTH in @atlas/auth/password-policy and
 * `minimum_password_length` in supabase/config.toml.
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
    // Tenant-specific URL Supabase should send the email-verification link back
    // to. Computed server-side from the tenant origin, never trusted from the
    // browser form.
    emailRedirectTo: z.url().max(500).optional(),
  })
  .strict();

// Email one-time-token kinds accepted by the SSR verification route. These map
// to Supabase's EmailOtpType (token-hash flow); `phone`/`sms` kinds are handled
// elsewhere and intentionally excluded here.
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
    // Single-use, server-verified hash from the email link (PKCE/SSR flow).
    // The session itself never travels through the URL.
    tokenHash: z.string().min(1).max(4000),
    type: PublicEmailOtpTypeSchema,
  })
  .strict();

export const PublicAuthResendRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    // Tenant-specific URL Supabase should send the new verification link back
    // to. Computed server-side from the tenant origin, never trusted from the
    // browser form.
    emailRedirectTo: z.url().max(500).optional(),
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
    accessToken: z.string().min(1).max(4000),
    refreshToken: z.string().max(4000).optional(),
  })
  .strict();
