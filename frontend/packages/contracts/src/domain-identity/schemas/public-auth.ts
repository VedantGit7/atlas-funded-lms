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
    /**
     * Supabase's PKCE verifier, for the web app to keep until the callback.
     * Better Auth keeps its own and sets a signed state cookie instead.
     */
    codeVerifier: z.string().min(1).optional(),
  }),
});

export const PublicOAuthCallbackRequestSchema = z
  .object({
    code: z.string().min(1).max(4000),
    /** Supabase: the verifier from the start. */
    codeVerifier: z.string().min(1).max(4000).optional(),
    /** Better Auth: Google's state parameter, checked against its signed cookie. */
    state: z.string().min(1).max(500).optional(),
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
    /** Supabase: the session the recovery link signed in. Empty with Better Auth. */
    accessToken: z.string().max(4000).optional(),
    refreshToken: z.string().max(4000).optional(),
    /**
     * Better Auth: the single-use token in the reset link (launch plan task
     * 3.2). Empty with Supabase. One of the two must be present.
     */
    token: z.string().max(512).optional(),
    /**
     * Authenticator code, for accounts with MFA: the recovery link signs in at
     * aal1 and Supabase only changes their password at aal2. Empty until the
     * reset form asks for it.
     */
    mfaCode: z
      .string()
      .trim()
      .refine((code) => code === "" || /^\d{6}$/.test(code), {
        message: "Enter the 6-digit code from your authenticator app.",
      })
      .optional(),
  })
  .strict()
  .refine((input) => Boolean(input.token) || Boolean(input.accessToken), {
    message: "Reset link is invalid or expired.",
    path: ["token"],
  });

/**
 * RESET: the password changed. MFA_REQUIRED / MFA_INVALID: the account has
 * MFA and the authenticator code was missing or did not verify; nothing changed.
 */
export const PublicPasswordResetCompleteResponseSchema = z.object({
  data: z.object({
    status: z.enum(["RESET", "MFA_REQUIRED", "MFA_INVALID"]),
  }),
});

export type PublicPasswordResetCompleteResponse = z.infer<
  typeof PublicPasswordResetCompleteResponseSchema
>;
