import { permissionsSeed } from "./00-permissions";
import { rolesSeed } from "./01-roles";
import { featureFlagsSeed } from "./02-feature-flags";
import { entitlementsSeed } from "./03-entitlements";
import { itemTypesSeed } from "./04-item-types";
import { extensionPointsSeed } from "./05-extension-points";
import { workflowsSeed } from "./06-workflows";
import { demoTenantsSeed } from "./07-demo-tenants";
import { practiceContentSeed } from "./08-practice-content";
import type { SeedContext, SeedGroup, SeedMode, SeedModule, SeedResult } from "./types";

// Kept apart from index.ts, the CLI: a bundle that imports this (the migration
// job's global-catalogues.ts) must not also run the CLI's main().
export const seedModules: readonly SeedModule[] = [
  permissionsSeed,
  rolesSeed,
  featureFlagsSeed,
  entitlementsSeed,
  itemTypesSeed,
  extensionPointsSeed,
  workflowsSeed,
  demoTenantsSeed,
  practiceContentSeed,
];

export async function runSeeds(
  group: SeedGroup = "all",
  mode: SeedMode = "dry-run",
): Promise<SeedResult[]> {
  const ctx: SeedContext = {
    group,
    mode,
    log: (message) => {
      console.log(message);
    },
  };

  const selectedModules = seedModules.filter((module) => module.groups.includes(group));

  const results: SeedResult[] = [];

  for (const module of selectedModules) {
    results.push(await module.run(ctx));
  }

  return results;
}
