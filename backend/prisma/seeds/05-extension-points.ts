import { withPlatformScope } from "@atlas/db";
import { stableSeedId } from "./ids";
import { emptySeedResult, type SeedModule, type SeedResult } from "./types";

const SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID = "018f0000-0000-7000-8000-000000000099";

const EXTENSION_POINTS = [
  {
    key: "item_type_renderer",
    pointType: "item_type_renderer",
    schemaJson: {
      fields: ["rendererKey", "config"],
    },
  },
] as const;

async function seedExtensionPoints(): Promise<SeedResult> {
  let inserted = 0;
  let skipped = 0;

  await withPlatformScope(
    {
      principalId: SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID,
      requestId: "seed_extension_points",
      requiredPermission: "platform.catalog.manage",
      platformPermissions: ["platform.catalog.manage"],
    },
    "Seeding global extension points catalogue",
    async (tx) => {
      for (const point of EXTENSION_POINTS) {
        const id = stableSeedId("extension_point", point.key);
        const existing = await tx.$queryRaw<Array<{ id: string }>>`
          select id::text from extension_points where key = ${point.key} limit 1
        `;

        if (existing.length > 0) {
          skipped += 1;
          continue;
        }

        await tx.$executeRaw`
          insert into extension_points (
            id,
            key,
            point_type,
            schema_json,
            status,
            created_at,
            updated_at
          )
          values (
            ${id}::uuid,
            ${point.key},
            ${point.pointType},
            ${JSON.stringify(point.schemaJson)}::jsonb,
            'ACTIVE',
            now(),
            now()
          )
        `;

        inserted += 1;
      }
    },
  );

  return {
    name: "05-extension-points",
    planned: EXTENSION_POINTS.length,
    inserted,
    updated: 0,
    skipped,
  };
}

export const extensionPointsSeed: SeedModule = {
  name: "05-extension-points",
  groups: ["all", "catalogues"],
  async run(ctx): Promise<SeedResult> {
    if (ctx.mode === "dry-run") {
      ctx.log("[05-extension-points] dry-run only; no rows inserted");
      return emptySeedResult("05-extension-points");
    }

    ctx.log(`[05-extension-points] seeding ${String(EXTENSION_POINTS.length)} extension points`);
    return seedExtensionPoints();
  },
};
