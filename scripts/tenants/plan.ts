import {
  buildApplyPlan,
  formatApplyPlan,
  loadTenantManifest,
  validateManifest,
} from "@atlas/tenant-config";
import { parseTenantCliArgs, resolveEnvironment } from "./cli-args";

async function main(): Promise<void> {
  const args = parseTenantCliArgs(process.argv.slice(2));
  const environment = resolveEnvironment(args);
  const manifest = loadTenantManifest(args.tenant, args.configsRoot);
  const validation = validateManifest(manifest);

  if (!validation.valid) {
    console.error(`[tenant-config:plan] validation failed for tenant=${args.tenant}`);
    for (const issue of validation.issues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }

  const plan = buildApplyPlan(manifest, environment, {
    productionPlanOnly: args.productionPlanOnly ?? environment === "production",
  });

  console.log(formatApplyPlan(plan));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
