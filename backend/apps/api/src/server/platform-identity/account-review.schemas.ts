import { z } from "zod";

/** Platform review of account status. */

const decisionReasonSchema = z.string().trim().min(10).max(1000);

export const AccountParamsSchema = z.object({ id: z.uuid() }).strict();

export const AccountStatusRequestSchema = z
  .object({
    status: z.enum(["active", "disabled"]),
    reason: decisionReasonSchema,
  })
  .strict();

export const AccountLookupQuerySchema = z
  .object({ email: z.string().trim().toLowerCase().max(320).pipe(z.email()) })
  .strict();

export const PlatformAccountStatusSchema = z.enum(["active", "unclaimed", "disabled"]);

export const PlatformAccountViewSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  status: PlatformAccountStatusSchema,
  createdAt: z.iso.datetime(),
  lastLoginAt: z.iso.datetime().nullable(),
  activeMembershipCount: z.number().int().min(0),
  platformRole: z.string().nullable(),
});

export const PlatformAccountLookupResponseSchema = z.object({
  data: PlatformAccountViewSchema.nullable(),
});

export const PlatformAccountResponseSchema = z.object({
  data: PlatformAccountViewSchema,
});

export type AccountStatusRequest = z.infer<typeof AccountStatusRequestSchema>;
