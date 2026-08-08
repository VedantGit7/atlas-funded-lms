import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
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

function parseGroup(value: string | undefined): SeedGroup {
  if (
    value === "catalogues" ||
    value === "tenants" ||
    value === "fundedbeyond" ||
    value === "smoke-tenant" ||
    value === "all"
  ) {
    return value;
  }

  return "all";
}

function parseMode(args: readonly string[]): SeedMode {
  return args.includes("--apply") ? "apply" : "dry-run";
}

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const group = parseGroup(args[0]);
  const mode = parseMode(args);

  console.log(`[seed] group=${group} mode=${mode}`);

  const results = await runSeeds(group, mode);

  for (const result of results) {
    console.log(
      `[seed] ${result.name}: planned=${String(result.planned)} inserted=${String(result.inserted)} updated=${String(result.updated)} skipped=${String(result.skipped)}`,
    );
  }

  const totalPlanned = results.reduce((sum, result) => sum + result.planned, 0);
  const totalInserted = results.reduce((sum, result) => sum + result.inserted, 0);
  const totalUpdated = results.reduce((sum, result) => sum + result.updated, 0);
  const totalSkipped = results.reduce((sum, result) => sum + result.skipped, 0);

  console.log(
    `[seed] total: planned=${String(totalPlanned)} inserted=${String(totalInserted)} updated=${String(totalUpdated)} skipped=${String(totalSkipped)}`,
  );
}

const entryPath = process.argv[1];
if (entryPath && fileURLToPath(import.meta.url) === resolve(entryPath)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
