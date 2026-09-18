import { z } from "zod";
import {
  mergeNotificationPreferences,
  validateNotificationPreferenceInput,
} from "./notification-preferences.catalog";
import {
  listMemberNotificationPreferenceOverrides,
  upsertMemberNotificationPreferences,
} from "./member-notification-preferences.repository";
import { readMemberProfileMetadata, writeMemberProfileMetadata } from "./member-admin.repository";

const channelPrefsSchema = z.object({
  email: z.boolean(),
  inApp: z.boolean(),
});

/**
 * Personal appearance + accessibility preferences. Applied per account only;
 * they never change the academy branding for other members.
 */
const appearancePreferencesSchema = z.object({
  mode: z.enum(["system", "light", "dark"]).default("system"),
  accentColor: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/u, "Invalid color")
    .nullable()
    .default(null),
  fontSize: z.enum(["normal", "large"]).default("normal"),
  reducedMotion: z.boolean().default(false),
  highContrast: z.boolean().default(false),
});

/** Course-player and study preferences that follow the learner across courses. */
const learningPreferencesSchema = z.object({
  autoplayVideos: z.boolean().default(true),
  autoplayNextLesson: z.boolean().default(true),
  playbackSpeed: z.enum(["0.75", "1", "1.25", "1.5", "1.75", "2"]).default("1"),
  captionsDefault: z.boolean().default(false),
  pauseOnBlur: z.boolean().default(false),
});

/** Consent + visibility preferences (data-processing choices). */
const privacyPreferencesSchema = z.object({
  analyticsConsent: z.boolean().default(true),
  marketingConsent: z.boolean().default(false),
  showLearningActivity: z.boolean().default(true),
});

const localePreferenceSchema = z.string().trim().min(2).max(35).nullable();

export const memberPreferencesResponseSchema = z.object({
  data: z.object({
    notifications: z.record(z.string(), channelPrefsSchema).default({}),
    appearance: appearancePreferencesSchema,
    learning: learningPreferencesSchema,
    privacy: privacyPreferencesSchema,
    locale: localePreferenceSchema.default(null),
  }),
});

export const updateMemberPreferencesBodySchema = z
  .object({
    notifications: z.record(z.string(), channelPrefsSchema.partial()).optional(),
    appearance: appearancePreferencesSchema.partial().optional(),
    learning: learningPreferencesSchema.partial().optional(),
    privacy: privacyPreferencesSchema.partial().optional(),
    locale: localePreferenceSchema.optional(),
  })
  .strict();

type MembershipCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

type Tx = Parameters<typeof listMemberNotificationPreferenceOverrides>[0]["tx"];

type StoredPreferences = {
  appearance: z.output<typeof appearancePreferencesSchema>;
  learning: z.output<typeof learningPreferencesSchema>;
  privacy: z.output<typeof privacyPreferencesSchema>;
  locale: string | null;
};

const METADATA_PREFERENCES_KEY = "preferences";

/** Reads a stored preference blob, applying defaults and dropping junk. */
function coercePreferences(raw: unknown): StoredPreferences {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const appearance = appearancePreferencesSchema.safeParse(obj["appearance"] ?? {});
  const learning = learningPreferencesSchema.safeParse(obj["learning"] ?? {});
  const privacy = privacyPreferencesSchema.safeParse(obj["privacy"] ?? {});
  const locale = localePreferenceSchema.safeParse(obj["locale"] ?? null);

  return {
    appearance: appearance.success ? appearance.data : appearancePreferencesSchema.parse({}),
    learning: learning.success ? learning.data : learningPreferencesSchema.parse({}),
    privacy: privacy.success ? privacy.data : privacyPreferencesSchema.parse({}),
    locale: locale.success ? locale.data : null,
  };
}

export async function getMemberPreferences(
  tx: Tx,
  ctx: MembershipCtx,
): Promise<z.output<typeof memberPreferencesResponseSchema>> {
  const [rows, metadata] = await Promise.all([
    listMemberNotificationPreferenceOverrides({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
    }),
    readMemberProfileMetadata({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
    }),
  ]);

  const overrides: Record<string, { email: boolean; inApp: boolean }> = {};
  for (const row of rows) {
    overrides[row.category_key] = { email: row.email_enabled, inApp: row.in_app_enabled };
  }

  const stored = coercePreferences(metadata[METADATA_PREFERENCES_KEY]);

  return {
    data: {
      notifications: mergeNotificationPreferences(overrides),
      appearance: stored.appearance,
      learning: stored.learning,
      privacy: stored.privacy,
      locale: stored.locale,
    },
  };
}

export async function updateMemberPreferences(
  tx: Tx,
  ctx: MembershipCtx,
  input: z.output<typeof updateMemberPreferencesBodySchema>,
): Promise<z.output<typeof memberPreferencesResponseSchema>> {
  const validated = validateNotificationPreferenceInput(input.notifications);
  if (Object.keys(validated).length > 0) {
    await upsertMemberNotificationPreferences({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
      preferences: validated,
    });
  }

  const touchesSettings =
    input.appearance !== undefined ||
    input.learning !== undefined ||
    input.privacy !== undefined ||
    input.locale !== undefined;

  if (touchesSettings) {
    const metadata = await readMemberProfileMetadata({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
    });
    const current = coercePreferences(metadata[METADATA_PREFERENCES_KEY]);

    const next: StoredPreferences = {
      appearance: appearancePreferencesSchema.parse({
        ...current.appearance,
        ...input.appearance,
      }),
      learning: learningPreferencesSchema.parse({
        ...current.learning,
        ...input.learning,
      }),
      privacy: privacyPreferencesSchema.parse({
        ...current.privacy,
        ...input.privacy,
      }),
      locale: input.locale !== undefined ? input.locale : current.locale,
    };

    await writeMemberProfileMetadata({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
      metadata: { ...metadata, [METADATA_PREFERENCES_KEY]: next },
    });
  }

  return getMemberPreferences(tx, ctx);
}
