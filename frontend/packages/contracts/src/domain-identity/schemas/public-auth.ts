import { z } from "zod";

export const publicAuthStatusSchema = z.enum([
  "AUTHENTICATED",
  "EMAIL_VERIFICATION_REQUIRED",
  "MFA_REQUIRED",
  "NO_ACTIVE_MEMBERSHIP",
  "INVITED_MEMBERSHIP",
  "TERMS_REQUIRED",
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
    /**
     * Started from the sign-up page after "I agree" was ticked: Google may
     * create a new account. From anywhere else it signs in existing accounts
     * only (launch plan 5.7).
     */
    signUp: z.boolean().optional(),
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
    /** When "I agree" was ticked before a Google sign-up (launch plan 5.7). */
    termsAcceptedAt: z.iso.datetime().optional(),
  })
  .strict();

/**
 * Minimum length for a password being set (audit H6). Sign-in schemas keep the
 * older minimum so existing passwords still work until they are changed. Must
 * match NEW_PASSWORD_MIN_LENGTH in @atlas/auth/password-policy.
 */
export const NEW_PASSWORD_MIN_LENGTH = 10;

/**
 * Starts a sign-up. The password isn't asked for here: it is chosen on the
 * page the emailed link opens, once the address is proven (security review
 * 5.3, finding 1).
 */
export const PublicSignupRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    displayName: z.string().trim().min(2).max(120),
    inviteToken: z.string().min(20).max(500).optional(),
    /**
     * The "I agree" box: 18 or older, and agreeing to the academy's Terms and
     * Privacy Policy. No account is opened without it (launch plan 5.7).
     */
    acceptTerms: z.literal(true, {
      error: "Tick the box to agree to the Terms and Privacy Policy.",
    }),
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

/**
 * Joins this academy as someone already signed in, by agreeing to its Terms
 * and Privacy Policy (launch plan 5.7).
 */
export const PublicJoinRequestSchema = z
  .object({
    acceptTerms: z.literal(true, {
      error: "Tick the box to agree to the Terms and Privacy Policy.",
    }),
  })
  .strict();

/** Finishes a sign-up: the emailed link's single-use token and the chosen password. */
export const PublicSignupCompleteRequestSchema = z
  .object({
    token: z.string().min(20).max(200),
    // Better Auth's own ceiling is 128 characters.
    password: z.string().min(NEW_PASSWORD_MIN_LENGTH).max(128),
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
