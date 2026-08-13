import { z } from "zod";
import {
  KNOWN_ENTITLEMENT_KEYS,
  KNOWN_EXTENSION_POINT_KEYS,
  LEGAL_APPROVAL_STATUSES,
  OVERRIDABLE_FEATURE_FLAG_KEYS,
} from "./catalogue";

const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const hostnameSchema = z
  .string()
  .min(3)
  .max(253)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i);

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);

const rejectSecrets = z
  .object({
    ownerPrincipalId: z.never().optional(),
    serviceKey: z.never().optional(),
    storageKey: z.never().optional(),
    signedUrl: z.never().optional(),
    token: z.never().optional(),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .loose();

export const entitlementGrantSchema = z
  .object({
    key: z.enum(KNOWN_ENTITLEMENT_KEYS),
    enabled: z.boolean().default(true),
    value: z.unknown().nullable().optional(),
    expiresAt: z.iso.datetime().nullable().optional(),
  })
  .strict();

export const featureFlagOverrideSchema = z
  .object({
    key: z.enum(OVERRIDABLE_FEATURE_FLAG_KEYS),
    value: z.record(z.string(), z.unknown()),
  })
  .strict();

export const extensionRegistrationSchema = z
  .object({
    extensionPointKey: z.enum(KNOWN_EXTENSION_POINT_KEYS),
    registrationKey: z.string().min(1).max(64),
    configJson: z.record(z.string(), z.unknown()).default({}),
    status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]).default("ACTIVE"),
  })
  .strict();

export const dimensionConfigSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullable().optional(),
  })
  .strict();

export const bandConfigSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
    label: z.string().min(1).max(120),
    minScore: z.number().min(0).max(100),
    maxScore: z.number().min(0).max(100),
    sortOrder: z.number().int().min(0).max(100),
  })
  .strict();

export const scoringConfigSchema = z
  .object({
    profileKey: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    profileName: z.string().min(1).max(120),
    dimensions: z.array(dimensionConfigSchema).min(1),
    bands: z.array(bandConfigSchema).min(1),
  })
  .strict();

export const bandProminenceRuleSchema = z
  .object({
    bandKey: z.string().min(1).max(64),
    prominence: z.enum(["hidden", "subtle", "standard", "prominent"]),
  })
  .strict();

export const readinessManifestSchema = z
  .object({
    legalApproval: z
      .object({
        status: z.enum(LEGAL_APPROVAL_STATUSES),
        reference: z.string().min(1).max(200).nullable(),
      })
      .strict()
      .superRefine((value, ctx) => {
        if (value.status === "approved" && !value.reference) {
          ctx.addIssue({
            code: "custom",
            message: "Legal approval reference is required when status is approved.",
            path: ["reference"],
          });
        }
      }),
    ctaPolicy: z
      .object({
        outboundTargetUrl: z
          .url()
          .refine((url) => url.startsWith("https://"), "CTA target must use HTTPS."),
        tokenTtlSeconds: z.number().int().min(60).max(86_400),
        bandProminenceRules: z.array(bandProminenceRuleSchema).min(1),
        ctaCopy: z
          .object({
            headline: z.string().min(1).max(200),
            body: z.string().min(1).max(2000),
            buttonLabel: z.string().min(1).max(120),
          })
          .strict()
          .optional(),
      })
      .strict(),
    legalCopy: z
      .object({
        disclaimer: z.string().min(1).max(4000),
        bandNotes: z.record(z.string(), z.string().max(1000)),
        legalReviewChecklist: z.array(z.string().min(1).max(500)).min(1),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.legalApproval.status === "pending_approval") {
      if (value.ctaPolicy.ctaCopy !== undefined || value.legalCopy !== undefined) {
        ctx.addIssue({
          code: "custom",
          message:
            "CTA and legal copy must not be supplied while legal approval is pending_approval.",
        });
      }
      return;
    }

    if (!value.ctaPolicy.ctaCopy) {
      ctx.addIssue({
        code: "custom",
        message: "ctaPolicy.ctaCopy is required when legal approval is approved.",
        path: ["ctaPolicy", "ctaCopy"],
      });
    }

    if (!value.legalCopy) {
      ctx.addIssue({
        code: "custom",
        message: "legalCopy is required when legal approval is approved.",
        path: ["legalCopy"],
      });
    }
  });

export const learningPathManifestSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1).max(200),
    description: z.string().max(5000).nullable().optional(),
    pathType: z.enum(["program", "roadmap"]).default("program"),
    metadata: z.record(z.string(), z.unknown()).optional(),
    availability: z.enum(["draft", "unavailable"]).default("draft"),
  })
  .strict();

export const certificateTemplateManifestSchema = z
  .object({
    key: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    name: z.string().min(1).max(160),
    templateJson: z
      .object({
        headline: z.string().min(1).max(160),
        subheadline: z.string().max(240).optional(),
        bodyLines: z.array(z.string().min(1).max(500)).max(12).default([]),
        accentColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
      })
      .strict(),
  })
  .strict();

export const badgeManifestSchema = z
  .object({
    key: z.string().min(1).max(64),
    name: z.string().min(1).max(160),
    iconKey: z.string().min(1).max(64).optional(),
    criteria: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("event_count"),
          eventType: z.string().min(1).max(128),
          minCount: z.number().int().min(1),
        })
        .strict(),
      z
        .object({
          type: z.literal("streak_current"),
          streakKey: z.string().min(1).max(64),
          minCount: z.number().int().min(1),
        })
        .strict(),
    ]),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("INACTIVE"),
  })
  .strict();

export const leaderboardManifestSchema = z
  .object({
    key: z.string().min(1).max(64),
    name: z.string().min(1).max(160),
    metricKey: z.literal("xp_total").default("xp_total"),
    windowKey: z.enum(["all_time", "weekly", "monthly"]).default("all_time"),
    maxEntries: z.number().int().min(1).max(100).default(10),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("INACTIVE"),
  })
  .strict();

export const communitySpaceManifestSchema = z
  .object({
    slug: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1).max(120),
    visibility: z.enum(["PRIVATE", "TENANT"]).default("PRIVATE"),
    configJson: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const domainRecordSchema = z
  .object({
    hostname: hostnameSchema,
    type: z.enum(["ATLAS_SUBDOMAIN", "CUSTOM_DOMAIN"]),
    makePrimary: z.boolean().default(false),
    recordOnly: z.boolean().default(true),
  })
  .strict();

export const environmentDomainsSchema = z
  .object({
    development: domainRecordSchema.optional(),
    test: domainRecordSchema.optional(),
    staging: domainRecordSchema.optional(),
    production: domainRecordSchema.optional(),
  })
  .strict();

export const brandingManifestSchema = z
  .object({
    publicName: z.string().min(2).max(120),
    issuerName: z.string().min(2).max(160).nullable().optional(),
    publicLandingCopy: z.record(z.string(), z.unknown()).nullable().optional(),
    logoLightStorageRefId: z.uuid().nullable().optional(),
    logoDarkStorageRefId: z.uuid().nullable().optional(),
    faviconStorageRefId: z.uuid().nullable().optional(),
  })
  .strict();

export const themeManifestSchema = z
  .object({
    tokens: z
      .object({
        primary: hexColorSchema,
        accent: hexColorSchema.optional(),
        header: hexColorSchema.optional(),
        background: hexColorSchema.optional(),
        foreground: hexColorSchema.optional(),
        radius: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
        modeDefault: z.enum(["system", "light", "dark"]).default("system"),
      })
      .strict(),
    assetTokensRef: z.string().min(1).max(120).optional(),
  })
  .strict();

export const tenantIdentitySchema = z
  .object({
    slug: slugSchema,
    displayName: z.string().min(2).max(120),
    legalName: z.string().max(180).nullable().optional(),
    defaultLocale: z.string().min(2).max(12).default("en"),
    defaultTimezone: z.string().min(1).max(80).default("UTC"),
  })
  .strict();

export const testOwnerSchema = z
  .object({
    email: z.email(),
    displayName: z.string().min(2).max(120),
  })
  .strict();

export const tenantManifestSchema = z
  .object({
    manifestVersion: z.literal("1"),
    tenant: tenantIdentitySchema,
    domains: environmentDomainsSchema,
    branding: brandingManifestSchema,
    theme: themeManifestSchema,
    entitlements: z.array(entitlementGrantSchema).default([]),
    featureFlagOverrides: z.array(featureFlagOverrideSchema).default([]),
    extensions: z.array(extensionRegistrationSchema).default([]),
    scoring: scoringConfigSchema,
    readiness: readinessManifestSchema,
    learningPaths: z.array(learningPathManifestSchema).default([]),
    certificateTemplates: z.array(certificateTemplateManifestSchema).default([]),
    gamification: z
      .object({
        badges: z.array(badgeManifestSchema).default([]),
        leaderboards: z.array(leaderboardManifestSchema).default([]),
      })
      .strict()
      .default({ badges: [], leaderboards: [] }),
    communitySpaces: z.array(communitySpaceManifestSchema).default([]),
    locale: z
      .object({
        code: z.string().min(2).max(12),
      })
      .strict(),
    tenantConfigJson: z.record(z.string(), z.unknown()).default({}),
    testOwner: testOwnerSchema.optional(),
  })
  .strict()
  .and(rejectSecrets);

export type TenantManifestInput = z.input<typeof tenantManifestSchema>;

export function parseTenantManifest(raw: unknown) {
  return tenantManifestSchema.parse(raw);
}
