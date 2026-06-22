import { randomUUID } from "node:crypto";
import { withPlatformScope } from "@atlas/db";
import { loadTenantManifest } from "@atlas/tenant-config";
import { applyTenantManifest } from "./apply-adapter";
import { parseTenantCliArgs, resolveEnvironment } from "./cli-args";

async function main(): Promise<void> {
  const args = parseTenantCliArgs(process.argv.slice(2));
  const environment = resolveEnvironment(args);
  const manifest = loadTenantManifest(args.tenant, args.configsRoot);

  const applied = await applyTenantManifest(manifest, {
    environment,
    platformPrincipalId: randomUUID(),
    requestId: randomUUID(),
    reason: `Tenant config smoke apply (${environment})`,
    tenantBaseDomain: process.env["TENANT_BASE_DOMAIN"] ?? "localhost.test",
    ownerEmail: manifest.testOwner?.email ?? `${manifest.tenant.slug}-owner@example.test`,
    ownerDisplayName: manifest.testOwner?.displayName ?? `${manifest.tenant.displayName} Owner`,
  });

  if (!applied.tenantId) {
    throw new Error("Smoke apply did not return tenantId.");
  }

  const domain = manifest.domains[environment];
  if (domain) {
    const resolved = await withPlatformScope(
      {
        principalId: randomUUID(),
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId: applied.tenantId,
        touchedTenantIds: [applied.tenantId],
      },
      "Tenant config smoke host resolution",
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ tenant_id: string; slug: string; hostname: string }>
        >`
          SELECT t.id::text AS tenant_id, t.slug, td.hostname
          FROM tenant_domains td
          JOIN tenants t ON t.id = td.tenant_id
          WHERE lower(td.hostname) = ${domain.hostname.toLowerCase()}
            AND td.deleted_at IS NULL
            AND t.deleted_at IS NULL
          LIMIT 1
        `;
        return rows[0];
      },
    );

    if (!resolved || resolved.slug !== manifest.tenant.slug) {
      throw new Error("Smoke host resolution failed.");
    }
  }

  console.log(
    `[tenant-config:smoke] tenant=${manifest.tenant.slug} environment=${environment} tenantId=${applied.tenantId} OK`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
