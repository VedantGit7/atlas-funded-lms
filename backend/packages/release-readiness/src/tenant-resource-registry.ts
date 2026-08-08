import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type TenantResourceRegistryEntry = {
  routeMetadataPath: string;
  apiPath: string;
  domain: string;
  hasResourceLoader: boolean;
  hasIdParam: boolean;
  requiredCoverage: Array<
    "foreign_read" | "foreign_mutation" | "foreign_parent_create" | "negative_sentinel"
  >;
  isolationTestFile: string | null;
  rationale?: string;
};

const DOMAIN_ISOLATION_TEST_MAP: Record<string, string> = {
  "item-registry": "item-registry.test.ts",
  items: "item-registry.test.ts",
  "item-collections": "item-registry.test.ts",
  "item-types": "item-registry.test.ts",
  "extension-points": "item-registry.test.ts",
  extensions: "item-registry.test.ts",
  "learning-paths": "learning-paths.test.ts",
  grading: "grading.test.ts",
  "grading-tasks": "grading.test.ts",
  gamification: "gamification.test.ts",
  leaderboards: "gamification.test.ts",
  badges: "gamification.test.ts",
  "competency-config": "competency-config.test.ts",
  "competency-dimensions": "competency-config.test.ts",
  "competency-signals": "competency-projection.test.ts",
  "scoring-profiles": "competency-config.test.ts",
  "scoring-config": "competency-config.test.ts",
  "competency-projection": "competency-projection.test.ts",
  readiness: "readiness.test.ts",
  "readiness-policy": "readiness.test.ts",
  cta: "readiness.test.ts",
  practice: "practice.test.ts",
  "practice-sessions": "practice.test.ts",
  attempts: "assessments.test.ts",
  assessments: "assessments.test.ts",
  "assessment-catalog": "assessments.test.ts",
  "assessment-create": "assessments.test.ts",
  "item-catalog": "item-registry.test.ts",
  "item-collection-manage": "item-registry.test.ts",
  "extension-catalog": "item-registry.test.ts",
  "extension-registration-manage": "item-registry.test.ts",
  certificates: "certificates.test.ts",
  diagnostic: "diagnostic.test.ts",
  diagnostics: "diagnostic.test.ts",
  "deletion-requests": "data-rights.test.ts",
  domains: "branding-domain.isolation.test.ts",
  exports: "data-rights.test.ts",
  "feature-flags": "entitlements-feature-flags.isolation.test.ts",
  courses: "course-catalog-enrollment.test.ts",
  workflows: "workflows.test.ts",
  community: "community.test.ts",
  moderation: "moderation.test.ts",
  notifications: "notifications.test.ts",
  automation: "automation-locales.test.ts",
  locales: "automation-locales.test.ts",
  analytics: "analytics.test.ts",
  "data-rights": "data-rights.test.ts",
  search: "search.test.ts",
  members: "can-members-route-idor.test.ts",
  roles: "admin-member-role-management.test.ts",
  enrollments: "course-catalog-enrollment.test.ts",
  lessons: "lesson-engine-progress.test.ts",
  modules: "course-manager-builder.test.ts",
  me: "learner-shell.test.ts",
  competency: "competency-projection.test.ts",
  branding: "branding-domain.isolation.test.ts",
  tenancy: "branding-domain.isolation.test.ts",
  "permission-overrides": "admin-member-role-management.test.ts",
  admin: "admin-shell.test.ts",
  "learner-billing": "tenant-config.isolation.test.ts",
  decks: "practice.test.ts",
  reports: "analytics.test.ts",
  tags: "course-manager-builder.test.ts",
};

const COLLECTION_ONLY_DOMAINS = new Set(["members", "roles", "enrollments", "workflows"]);

function walkFiles(directory: string): string[] {
  try {
    return readdirSync(directory).flatMap((entry) => {
      const fullPath = join(directory, entry);
      const stat = statSync(fullPath);
      return stat.isDirectory() ? walkFiles(fullPath) : [fullPath];
    });
  } catch {
    return [];
  }
}

function inferDomainFromMetadata(content: string, metadataPath: string): string {
  const importMatch = content.match(
    /from\s+["'](?:@\/|@atlas\/api-server\/|\.\.\/)+(?:server\/|modules\/)?([\w-]+)\//,
  );
  if (importMatch?.[1]) {
    const domain = importMatch[1] === "diagnostics" ? "diagnostic" : importMatch[1];
    return domain;
  }

  const loaderMatch = content.match(/load(\w+)ResourceRef/);
  if (loaderMatch?.[1]) {
    return loaderMatch[1].replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  }

  const apiSegment = metadataPath.replace(/\\/g, "/").split("/api/v1/")[1]?.split("/")[0];

  if (apiSegment && DOMAIN_ISOLATION_TEST_MAP[apiSegment]) {
    return apiSegment;
  }

  return apiSegment ?? "unknown";
}

function apiPathFromMetadata(metadataPath: string): string {
  const normalized = metadataPath.replace(/\\/g, "/");
  const match = normalized.match(/\/api\/v1\/(.+)\/route\.metadata\.ts$/);
  return match?.[1] ?? normalized;
}

function hasIdParam(apiPath: string): boolean {
  return apiPath.includes("[id]") || apiPath.includes("[locale]") || apiPath.includes("[key]");
}

function resolveIsolationTest(domain: string, isolationRoot: string): string | null {
  const mapped = DOMAIN_ISOLATION_TEST_MAP[domain];
  if (!mapped) {
    return null;
  }

  const fullPath = join(isolationRoot, mapped);
  return existsSync(fullPath) ? mapped : null;
}

function requiredCoverageFor(entry: {
  hasResourceLoader: boolean;
  hasIdParam: boolean;
  domain: string;
}): TenantResourceRegistryEntry["requiredCoverage"] {
  if (!entry.hasResourceLoader && !entry.hasIdParam) {
    return ["negative_sentinel"];
  }

  const coverage: TenantResourceRegistryEntry["requiredCoverage"] = [
    "foreign_read",
    "negative_sentinel",
  ];

  if (entry.hasIdParam || entry.hasResourceLoader) {
    coverage.push("foreign_mutation");
  }

  if (!COLLECTION_ONLY_DOMAINS.has(entry.domain) && entry.hasIdParam) {
    coverage.push("foreign_parent_create");
  }

  return coverage;
}

export function buildTenantResourceRegistry(options?: {
  repoRoot?: string;
  apiRoot?: string;
  isolationRoot?: string;
}): TenantResourceRegistryEntry[] {
  const repoRoot = options?.repoRoot ?? process.cwd();
  const apiRoot = options?.apiRoot ?? join(repoRoot, "backend/apps/api/src/app/api");
  const isolationRoot = options?.isolationRoot ?? join(repoRoot, "tests/tenant-isolation");

  const metadataFiles = walkFiles(apiRoot).filter((file) => /[/\\]route\.metadata\.ts$/.test(file));

  const entries: TenantResourceRegistryEntry[] = [];

  for (const metadataPath of metadataFiles) {
    const content = readFileSync(metadataPath, "utf8");

    if (content.includes("PlatformRouteMetadata")) {
      continue;
    }

    if (content.includes("public: true")) {
      continue;
    }

    const hasResourceLoader = content.includes("resourceLoader");
    const apiPath = apiPathFromMetadata(relative(repoRoot, metadataPath));
    const domain = inferDomainFromMetadata(content, metadataPath);
    const idParam = hasIdParam(apiPath);
    const isolationTestFile = resolveIsolationTest(domain, isolationRoot);

    entries.push({
      routeMetadataPath: relative(repoRoot, metadataPath).replace(/\\/g, "/"),
      apiPath,
      domain,
      hasResourceLoader,
      hasIdParam: idParam,
      requiredCoverage: requiredCoverageFor({
        hasResourceLoader,
        hasIdParam: idParam,
        domain,
      }),
      isolationTestFile,
      ...(isolationTestFile == null && (hasResourceLoader || idParam)
        ? { rationale: `No mapped isolation test for domain '${domain}'` }
        : {}),
    });
  }

  return entries.sort((a, b) => a.apiPath.localeCompare(b.apiPath));
}

export type RegistryCoverageReport = {
  total: number;
  covered: number;
  uncovered: TenantResourceRegistryEntry[];
  ok: boolean;
};

export function validateTenantResourceRegistryCoverage(
  entries: TenantResourceRegistryEntry[],
): RegistryCoverageReport {
  const needsCoverage = entries.filter((entry) => entry.hasResourceLoader || entry.hasIdParam);

  const uncovered = needsCoverage.filter((entry) => entry.isolationTestFile == null);

  return {
    total: needsCoverage.length,
    covered: needsCoverage.length - uncovered.length,
    uncovered,
    ok: uncovered.length === 0,
  };
}
