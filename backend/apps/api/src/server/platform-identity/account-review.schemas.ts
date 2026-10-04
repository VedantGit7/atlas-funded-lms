import { z } from "zod";

/** Audit H6: platform review of blocked re-registrations and account status. */

const decisionReasonSchema = z.string().trim().min(10).max(1000);

export const RelinkRequestParamsSchema = z.object({ id: z.uuid() }).strict();

export const AccountParamsSchema = z.object({ id: z.uuid() }).strict();

export const RelinkDecisionRequestSchema = z.object({ reason: decisionReasonSchema }).strict();

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

export const PlatformRelinkRequestViewSchema = z.object({
  id: z.uuid(),
  principalId: z.uuid(),
  email: z.string(),
  accountStatus: PlatformAccountStatusSchema,
  requestedAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  attemptCount: z.number().int().min(1),
  activeMembershipCount: z.number().int().min(0),
  platformRole: z.string().nullable(),
});

export const PlatformRelinkRequestListResponseSchema = z.object({
  data: z.array(PlatformRelinkRequestViewSchema),
});

export const PlatformRelinkDecisionResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    status: z.enum(["approved", "rejected"]),
    principalId: z.uuid(),
    platformGrantRevoked: z.boolean(),
  }),
});

export const PlatformAccountViewSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  status: PlatformAccountStatusSchema,
  createdAt: z.iso.datetime(),
  lastLoginAt: z.iso.datetime().nullable(),
  activeMembershipCount: z.number().int().min(0),
  platformRole: z.string().nullable(),
  pendingRelinkRequestCount: z.number().int().min(0),
});

export const PlatformAccountLookupResponseSchema = z.object({
  data: PlatformAccountViewSchema.nullable(),
});

export const PlatformAccountResponseSchema = z.object({
  data: PlatformAccountViewSchema,
});

export type RelinkDecisionRequest = z.infer<typeof RelinkDecisionRequestSchema>;
export type AccountStatusRequest = z.infer<typeof AccountStatusRequestSchema>;
