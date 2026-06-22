import {
  buildTenantResourceRegistry,
  validateTenantResourceRegistryCoverage,
} from "@atlas/release-readiness";

const entries = buildTenantResourceRegistry();
const report = validateTenantResourceRegistryCoverage(entries);

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      total: report.total,
      covered: report.covered,
      uncovered: report.uncovered.map((entry) => ({
        apiPath: entry.apiPath,
        domain: entry.domain,
        routeMetadataPath: entry.routeMetadataPath,
      })),
    },
    null,
    2,
  ),
);

if (!report.ok) {
  console.error(
    "\nBlocked CI: tenant-scoped routes with IDOR surface lack isolation test coverage.\n",
  );
  for (const entry of report.uncovered) {
    console.error(
      `- ${entry.apiPath} (${entry.domain}) → missing ${entry.isolationTestFile ?? "test file"}`,
    );
  }
  process.exit(1);
}

process.exit(0);
