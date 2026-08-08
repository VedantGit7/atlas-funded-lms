import { z } from "zod";

export const invitationTokenSchema = z
  .string()
  .min(32)
  .max(512)
  .regex(/^[A-Za-z0-9._~-]+$/, "Invalid invitation token format");

export const acceptInvitationInputSchema = z.object({
  token: invitationTokenSchema,
});

export const membershipStatusSchema = z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]);

export const meMembershipOutputSchema = z.object({
  data: z.object({
    tenant: z.object({
      id: z.string(),
      slug: z.string(),
      state: z.string(),
    }),
    identity: z.object({
      authenticated: z.literal(true),
      email: z.string().email(),
      emailNormalized: z.string().email(),
      mfaEnabled: z.boolean(),
      globalStatus: z.string(),
    }),
    membership: z.object({
      id: z.string(),
      status: z.literal("ACTIVE"),
      roleKeys: z.array(z.string()),
    }),
    profile: z
      .object({
        id: z.string(),
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      })
      .nullable(),
  }),
});

export const acceptInvitationOutputSchema = z.object({
  data: z.object({
    accepted: z.literal(true),
    membership: z.object({
      id: z.string(),
      status: z.literal("ACTIVE"),
    }),
    profile: z.object({
      id: z.string(),
      displayName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
    }),
  }),
});

export const membersListOutputSchema = z.object({
  data: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        status: membershipStatusSchema,
        profile: z
          .object({
            id: z.string(),
            displayName: z.string().nullable(),
            avatarUrl: z.string().nullable(),
          })
          .nullable(),
      }),
    ),
    pageInfo: z.object({
      nextCursor: z.string().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;
