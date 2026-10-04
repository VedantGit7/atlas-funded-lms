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

export const ChangePhoneRequestSchema = z
  .object({
    phone: z.string().min(8).max(20),
  })
  .strict();

export const VerifyPhoneRequestSchema = z
  .object({
    phone: z.string().min(8).max(20),
    token: z.string().min(4).max(10),
  })
  .strict();

export const MfaEnrollResponseSchema = z.object({
  data: z.object({
    factorId: z.string(),
    qrCode: z.string(),
    secret: z.string(),
    uri: z.string(),
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
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."),
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
