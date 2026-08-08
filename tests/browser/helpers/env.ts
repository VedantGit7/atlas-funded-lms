export function hasLearnerCredentials(): boolean {
  return Boolean(process.env["E2E_LEARNER_EMAIL"]?.trim() && process.env["E2E_LEARNER_PASSWORD"]?.trim());
}

export function hasInstructorCredentials(): boolean {
  return Boolean(
    process.env["E2E_INSTRUCTOR_EMAIL"]?.trim() && process.env["E2E_INSTRUCTOR_PASSWORD"]?.trim(),
  );
}

export function hasAdminCredentials(): boolean {
  return Boolean(process.env["E2E_ADMIN_EMAIL"]?.trim() && process.env["E2E_ADMIN_PASSWORD"]?.trim());
}

export function hasPlatformCredentials(): boolean {
  return Boolean(
    process.env["E2E_PLATFORM_EMAIL"]?.trim() && process.env["E2E_PLATFORM_PASSWORD"]?.trim(),
  );
}

export function secondTenantBaseUrl(): string {
  return process.env["E2E_SECOND_TENANT_BASE_URL"] ?? "http://second-smoke.localhost.test:3000";
}
