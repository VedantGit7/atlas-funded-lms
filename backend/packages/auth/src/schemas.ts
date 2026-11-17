import { z } from "zod";
import { NEW_PASSWORD_MIN_LENGTH } from "./password-policy";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/**
 * A sign-up names the address and the person; the password is chosen on the
 * page its emailed link opens (security review 5.3, finding 1).
 */
export const publicSignupInputSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(2).max(120).optional(),
  inviteToken: z.string().min(20).max(500).optional(),
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
});

/** The emailed link's single-use token, and the password chosen with it. */
export const publicSignupCompleteInputSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(NEW_PASSWORD_MIN_LENGTH).max(128),
});

export const publicLoginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const publicAuthOutputSchema = z.object({
  data: z.object({
    status: z.enum(["signed_in", "verification_required"]),
    identity: z
      .object({
        authenticated: z.literal(true),
        email: z.email(),
        emailNormalized: z.email(),
        mfaEnabled: z.boolean(),
        globalStatus: z.string(),
      })
      .optional(),
  }),
});

export const meOutputSchema = z.object({
  data: z.object({
    tenant: z.object({
      id: z.string(),
      slug: z.string(),
      state: z.string(),
    }),
    identity: z.discriminatedUnion("authenticated", [
      z.object({
        authenticated: z.literal(false),
      }),
      z.object({
        authenticated: z.literal(true),
        email: z.email(),
        emailNormalized: z.email(),
        mfaEnabled: z.boolean(),
        globalStatus: z.string(),
      }),
    ]),
  }),
});

export type PublicSignupInput = z.infer<typeof publicSignupInputSchema>;
export type PublicSignupCompleteInput = z.infer<typeof publicSignupCompleteInputSchema>;
export type PublicLoginInput = z.infer<typeof publicLoginInputSchema>;
