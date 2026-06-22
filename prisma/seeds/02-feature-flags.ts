import { withPlatformScope } from "@atlas/db";
import { stableSeedId } from "./ids";
import { emptySeedResult, type SeedModule, type SeedResult } from "./types";

const SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID = "018f0000-0000-7000-8000-000000000099";

const GLOBAL_FEATURE_FLAGS = [
  {
    key: "analytics.dashboard.view",
    defaultValue: { enabled: false },
    description: "Global feature flag for analytics.dashboard.view",
  },
] as const;

async function seedFeatureFlags(): Promise<SeedResult> {
  let inserted = 0;
  let skipped = 0;

  await withPlatformScope(
    {
      principalId: SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID,
      requestId: "seed_feature_flags",
      requiredPermission: "platform.catalog.manage",
      platformPermissions: ["platform.catalog.manage"],
    },
    "Seeding global feature flags catalogue",
    async (tx) => {
      for (const flag of GLOBAL_FEATURE_FLAGS) {
        const id = stableSeedId("feature_flag", flag.key);
        const existing = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id::text FROM feature_flags WHERE key = ${flag.key} LIMIT 1
        `;

        if (existing.length > 0) {
          skipped += 1;
          continue;
        }

        await tx.$executeRaw`
          INSERT INTO feature_flags (
            id,
            key,
            default_value,
            description,
            created_at,
            updated_at
          )
          VALUES (
            ${id}::uuid,
            ${flag.key},
            ${JSON.stringify(flag.defaultValue)}::jsonb,
            ${flag.description},
            now(),
            now()
          )
        `;

        inserted += 1;
      }
    },
  );

  return {
    name: "02-feature-flags",
    planned: GLOBAL_FEATURE_FLAGS.length,
    inserted,
    updated: 0,
    skipped,
  };
}

export const featureFlagsSeed: SeedModule = {
  name: "02-feature-flags",
  groups: ["all", "catalogues"],
  async run(ctx): Promise<SeedResult> {
    if (ctx.mode === "dry-run") {
      ctx.log("[02-feature-flags] dry-run only; no rows inserted");
      return emptySeedResult("02-feature-flags");
    }

    ctx.log(`[02-feature-flags] seeding ${String(GLOBAL_FEATURE_FLAGS.length)} feature flags`);
    return seedFeatureFlags();
  },
};
