// The migration job's `catalogues` step (scripts/db/migration-job.mjs), bundled
// into the atlas-migrate image by deploy/managed-node/build-migrate-seed.mjs.
//
// Seeds the platform-wide catalogues this release's code relies on: the
// permission catalogue above all, without which every permission check fails as
// UNKNOWN_PERMISSION. Each module only adds what is missing (permissions also
// refresh their descriptions), so it runs on every deploy.
//
// It never touches a tenant: new tenants get their roles and workflows when
// they are provisioned, and a tenant's own changes to them must survive deploys.
import { runSeeds } from "./run-seeds";

const results = await runSeeds("global", "apply");

for (const result of results) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
