import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

export const publicSignupInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(120).optional(),
  inviteToken: z.string().min(20).max(500).optional(),
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
        email: z.string().email(),
        emailNormalized: z.string().email(),
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
        email: z.string().email(),
        emailNormalized: z.string().email(),
        mfaEnabled: z.boolean(),
        globalStatus: z.string(),
      }),
    ]),
  }),
});

export type PublicSignupInput = z.infer<typeof publicSignupInputSchema>;
export type PublicLoginInput = z.infer<typeof publicLoginInputSchema>;
