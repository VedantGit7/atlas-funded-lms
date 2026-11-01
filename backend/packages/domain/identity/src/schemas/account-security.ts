import { z } from "zod";
import { NEW_PASSWORD_MIN_LENGTH, PublicOAuthProviderSchema } from "./public-auth";

export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(8).max(200),
    newPassword: z.string().min(NEW_PASSWORD_MIN_LENGTH).max(200),
  })
  .strict();

export const ChangeEmailRequestSchema = z
  .object({
    newEmail: z.email().transform((value) => value.trim().toLowerCase()),
    emailRedirectTo: z.url().max(500).optional(),
  })
  .strict();

/**
 * A code from the authenticator app, or one of the backup codes Better Auth
 * issues with it ("abcde-12345"; launch plan task 3.5).
 */
export const SecondFactorCodeSchema = z
  .string()
  .trim()
  .regex(
    /^(\d{6}|[A-Za-z0-9]{5}-?[A-Za-z0-9]{5})$/,
    "Enter the 6-digit code from your authenticator app, or a backup code.",
  );

/**
 * Setting up an authenticator. With Better Auth, an account that signs in
 * with a password confirms it first; Supabase doesn't ask.
 */
export const MfaEnrollRequestSchema = z
  .object({
    password: z.string().max(200).optional(),
  })
  .strict();

export const MfaEnrollResponseSchema = z.object({
  data: z.object({
    factorId: z.string(),
    qrCode: z.string(),
    secret: z.string(),
    uri: z.string(),
    /** Better Auth: ten single-use codes, shown once, for when the app isn't to hand. */
    backupCodes: z.array(z.string()).optional(),
  }),
});

export const MfaVerifyRequestSchema = z
  .object({
    factorId: z.string().min(1),
    code: z.string().min(6).max(8),
  })
  .strict();

/** Step-up: complete MFA for this session with an enrolled factor (audit H4). */
export const MfaStepUpRequestSchema = z
  .object({
    code: SecondFactorCodeSchema,
    factorId: z.string().min(1).optional(),
  })
  .strict();

export const MfaFactorSchema = z.object({
  id: z.string(),
  factorType: z.string(),
  status: z.string(),
  friendlyName: z.string().nullable().optional(),
});

export const MfaListResponseSchema = z.object({
  data: z.object({
    factors: z.array(MfaFactorSchema),
  }),
});

export const IdentitySchema = z.object({
  id: z.string(),
  provider: z.string(),
  email: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});

export const IdentitiesListResponseSchema = z.object({
  data: z.object({
    identities: z.array(IdentitySchema),
  }),
});

export const LinkIdentityRequestSchema = z
  .object({
    provider: PublicOAuthProviderSchema,
    redirectTo: z.url().max(500),
  })
  .strict();

export const LinkIdentityResponseSchema = z.object({
  data: z.object({
    url: z.url(),
  }),
});

export const MagicLinkRequestSchema = z
  .object({
    email: z.email().transform((value) => value.trim().toLowerCase()),
    emailRedirectTo: z.url().max(500).optional(),
  })
  .strict();

export const AccountSecurityOkResponseSchema = z.object({
  data: z.object({
    ok: z.literal(true),
  }),
});

export const ReauthenticateRequestSchema = z
  .object({
    password: z.string().min(8).max(200),
  })
  .strict();
