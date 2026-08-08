import { z } from "zod";

function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const tenantTimezoneSchema = z
  .string()
  .min(1)
  .max(80)
  .refine(isValidTimezone, { message: "Invalid IANA time zone." });

export const tenantTimezoneResponseSchema = z.object({
  data: z.object({
    timezone: z.string(),
  }),
});

export const updateTenantTimezoneBodySchema = z
  .object({
    timezone: tenantTimezoneSchema,
  })
  .strict();

export type TenantTimezoneResponse = z.infer<typeof tenantTimezoneResponseSchema>;
export type UpdateTenantTimezoneBody = z.infer<typeof updateTenantTimezoneBodySchema>;

export const videoQualityValues = ["high", "medium", "low", "auto"] as const;

export type VideoQuality = (typeof videoQualityValues)[number];

export const videoQualitySchema = z.enum(videoQualityValues);

export const tenantVideoQualityResponseSchema = z.object({
  data: z.object({
    quality: videoQualitySchema,
  }),
});

export const updateTenantVideoQualityBodySchema = z
  .object({
    quality: videoQualitySchema,
  })
  .strict();

export type TenantVideoQualityResponse = z.infer<typeof tenantVideoQualityResponseSchema>;
export type UpdateTenantVideoQualityBody = z.infer<typeof updateTenantVideoQualityBodySchema>;

export const tenantFastCheckoutResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean(),
  }),
});

export const updateTenantFastCheckoutBodySchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export type TenantFastCheckoutResponse = z.infer<typeof tenantFastCheckoutResponseSchema>;
export type UpdateTenantFastCheckoutBody = z.infer<typeof updateTenantFastCheckoutBodySchema>;

// Learner email verification: how many days the verification link stays valid.
// 0 means learners must verify before accessing the dashboard.
export const tenantLearnerEmailVerificationResponseSchema = z.object({
  data: z.object({
    verificationDays: z.number().int().min(0).max(365),
  }),
});

export const updateTenantLearnerEmailVerificationBodySchema = z
  .object({
    verificationDays: z.number().int().min(0).max(365),
  })
  .strict();

// Admin OTP: enable OTP for admin/sub-admin login, and the monthly login limit
// before OTP is triggered (0 = every login).
export const tenantAdminOtpResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean(),
    loginLimitPerMonth: z.number().int().min(0).max(1000),
  }),
});

export const updateTenantAdminOtpBodySchema = z
  .object({
    enabled: z.boolean(),
    loginLimitPerMonth: z.number().int().min(0).max(1000),
  })
  .strict();

// Device monitor: device registration limit and parallel-login restriction.
export const tenantDeviceMonitorResponseSchema = z.object({
  data: z.object({
    restrictionsEnabled: z.boolean(),
    registrationLimit: z.number().int().min(1).max(10),
    restrictParallelLogins: z.boolean(),
  }),
});

export const updateTenantDeviceMonitorBodySchema = z
  .object({
    restrictionsEnabled: z.boolean(),
    registrationLimit: z.number().int().min(1).max(10),
    restrictParallelLogins: z.boolean(),
  })
  .strict();

// Email channel (shared shape for transactional + marketing sender config).
const emailChannelFromName = z.string().trim().min(1).max(120);
const emailChannelEmail = z.string().trim().email().max(254);

export const tenantEmailChannelResponseSchema = z.object({
  data: z.object({
    fromName: z.string().max(120),
    fromEmail: z.string().max(254),
    replyToEmail: z.string().max(254).nullable(),
  }),
});

export const updateTenantEmailChannelBodySchema = z
  .object({
    fromName: emailChannelFromName,
    fromEmail: emailChannelEmail,
    replyToEmail: emailChannelEmail.nullable(),
  })
  .strict();

export type TenantLearnerEmailVerificationResponse = z.infer<
  typeof tenantLearnerEmailVerificationResponseSchema
>;
export type UpdateTenantLearnerEmailVerificationBody = z.infer<
  typeof updateTenantLearnerEmailVerificationBodySchema
>;
export type TenantAdminOtpResponse = z.infer<typeof tenantAdminOtpResponseSchema>;
export type UpdateTenantAdminOtpBody = z.infer<typeof updateTenantAdminOtpBodySchema>;
export type TenantDeviceMonitorResponse = z.infer<typeof tenantDeviceMonitorResponseSchema>;
export type UpdateTenantDeviceMonitorBody = z.infer<typeof updateTenantDeviceMonitorBodySchema>;
export type TenantEmailChannelResponse = z.infer<typeof tenantEmailChannelResponseSchema>;
export type UpdateTenantEmailChannelBody = z.infer<typeof updateTenantEmailChannelBodySchema>;

const SEO_META_DESCRIPTION_MAX = 5000;
const SEO_META_KEYWORDS_MAX = 2000;

export const tenantSeoSettingsSchema = z.object({
  metaDescription: z.string().max(SEO_META_DESCRIPTION_MAX),
  metaKeywords: z.string().max(SEO_META_KEYWORDS_MAX),
  metaImageRefId: z.string().uuid().nullable(),
});

export const tenantSeoResponseSchema = z.object({
  data: z.object({
    metaDescription: z.string().max(SEO_META_DESCRIPTION_MAX),
    metaKeywords: z.string().max(SEO_META_KEYWORDS_MAX),
    metaImageRefId: z.string().uuid().nullable(),
    metaImageUrl: z.string().nullable(),
  }),
});

export const updateTenantSeoBodySchema = tenantSeoSettingsSchema.strict();

export type TenantSeoSettings = z.infer<typeof tenantSeoSettingsSchema>;
export type TenantSeoResponse = z.infer<typeof tenantSeoResponseSchema>;
export type UpdateTenantSeoBody = z.infer<typeof updateTenantSeoBodySchema>;
