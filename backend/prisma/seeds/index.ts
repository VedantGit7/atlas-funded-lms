import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { runSeeds } from "./run-seeds";
import type { SeedGroup, SeedMode } from "./types";

export { runSeeds, seedModules } from "./run-seeds";

function parseGroup(value: string | undefined): SeedGroup {
  if (
    value === "catalogues" ||
    value === "global" ||
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
