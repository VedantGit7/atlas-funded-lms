import { z } from "zod";

export const OpenSupportSessionRequestSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
});

export const SupportSessionViewSchema = z.object({
  sessionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantSlug: z.string(),
  tenantDisplayName: z.string(),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: z.enum(["ACTIVE", "EXPIRED"]),
});

export const OpenSupportSessionResponseSchema = z.object({
  data: SupportSessionViewSchema,
});

export const ActiveSupportSessionListSchema = z.object({
  data: z.array(SupportSessionViewSchema),
});

export type SupportSessionView = z.infer<typeof SupportSessionViewSchema>;
