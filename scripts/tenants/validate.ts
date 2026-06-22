import { loadTenantManifest, validateManifest } from "@atlas/tenant-config";
import { parseTenantCliArgs } from "./cli-args";

async function main(): Promise<void> {
  const args = parseTenantCliArgs(process.argv.slice(2));
  const manifest = loadTenantManifest(args.tenant, args.configsRoot);
  const result = validateManifest(manifest);

  if (!result.valid) {
    console.error(`[tenant-config:validate] tenant=${args.tenant} FAILED`);
    for (const issue of result.issues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(
    `[tenant-config:validate] tenant=${args.tenant} OK manifestVersion=${manifest.manifestVersion}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
