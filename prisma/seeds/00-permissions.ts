import { PERMISSIONS, seedGlobalAccessCatalogue } from "@atlas/access";
import { emptySeedResult, type SeedModule, type SeedResult } from "./types";

export const permissionsSeed: SeedModule = {
  name: "00-permissions",
  groups: ["all", "catalogues"],
  async run(ctx): Promise<SeedResult> {
    if (ctx.mode === "dry-run") {
      ctx.log("[00-permissions] dry-run only; no rows inserted");
      return emptySeedResult("00-permissions");
    }

    ctx.log(`[00-permissions] seeding ${String(PERMISSIONS.length)} permissions`);

    await seedGlobalAccessCatalogue({
      requestId: "seed_permissions",
    });

    return {
      name: "00-permissions",
      planned: PERMISSIONS.length,
      inserted: PERMISSIONS.length,
      updated: 0,
      skipped: 0,
    };
  },
};

export async function seedPermissions(): Promise<void> {
  await seedGlobalAccessCatalogue({
    requestId: "seed_permissions",
  });
}
