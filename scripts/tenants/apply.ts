import { randomUUID } from "node:crypto";
import { loadTenantManifest, validateManifest } from "@atlas/tenant-config";
import { applyTenantManifest } from "./apply-adapter";
import { parseTenantCliArgs, resolveEnvironment } from "./cli-args";

async function main(): Promise<void> {
  const args = parseTenantCliArgs(process.argv.slice(2));
  const environment = resolveEnvironment(args);
  const manifest = loadTenantManifest(args.tenant, args.configsRoot);
  const validation = validateManifest(manifest);

  if (!validation.valid) {
    console.error(`[tenant-config:apply] validation failed for tenant=${args.tenant}`);
    for (const issue of validation.issues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }

  if (environment === "production" && !args.productionPlanOnly) {
    console.error(
      "[tenant-config:apply] Production apply refused. Use --production-plan-only to print the manual runbook plan.",
    );
    process.exit(1);
  }

  const ownerEmail =
    args.ownerEmail ??
    manifest.testOwner?.email ??
    process.env["TENANT_CONFIG_OWNER_EMAIL"] ??
    `${manifest.tenant.slug}-owner@example.test`;

  const ownerDisplayName =
    args.ownerDisplayName ??
    manifest.testOwner?.displayName ??
    process.env["TENANT_CONFIG_OWNER_DISPLAY_NAME"] ??
    `${manifest.tenant.displayName} Owner`;

  const result = await applyTenantManifest(manifest, {
    environment,
    platformPrincipalId:
      args.platformPrincipalId ??
      process.env["TENANT_CONFIG_PLATFORM_PRINCIPAL_ID"] ??
      randomUUID(),
    requestId: randomUUID(),
    reason: `ATL-STORY-044 tenant manifest apply (${environment})`,
    tenantBaseDomain: process.env["TENANT_BASE_DOMAIN"] ?? "localhost.test",
    ownerEmail,
    ownerDisplayName,
    productionPlanOnly: args.productionPlanOnly ?? environment === "production",
  });

  console.log(result.plan);

  if (result.tenantId) {
    console.log(
      `[tenant-config:apply] tenantId=${result.tenantId} actorMembershipId=${result.actorMembershipId}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
