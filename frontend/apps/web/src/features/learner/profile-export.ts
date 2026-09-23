type ExportGetter = (path: string) => Promise<{ data: unknown }>;

// JSON Pointer paths describe only values present in this downloaded snapshot.
function fieldPaths(value: unknown, path: string): string[] {
  if (value === null || typeof value !== "object") return [path];
  const entries = Object.entries(value);
  if (entries.length === 0) return [path];
  return entries.flatMap(([key, child]) =>
    fieldPaths(child, `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`),
  );
}

export async function loadProfileExport(membershipId: string, get: ExportGetter) {
  const [account, profile, preferences, entitlements] = await Promise.all([
    get("/api/v1/me"),
    get(`/api/v1/members/${membershipId}/profile`),
    get("/api/v1/me/preferences"),
    get("/api/v1/entitlements").then(
      (response) => ({ available: true as const, data: response.data }),
      () => ({ available: false as const }),
    ),
  ]);
  // Normalize to the JSON representation before inventorying fields.
  const payload = JSON.parse(
    JSON.stringify({
      account: account.data,
      profile: profile.data,
      preferences: preferences.data,
      ...(entitlements.available ? { entitlements: entitlements.data } : {}),
    }),
  ) as Record<string, unknown>;
  const omitted = [
    "learning_records",
    "assessment_submissions",
    "certificates",
    "billing_records",
    "community_contributions",
    "uploaded_files",
    "audit_and_security_logs",
    "other_school_records",
  ].map((category) => ({ category, reason: "outside_export_scope" }));
  if (!entitlements.available) omitted.push({ category: "entitlements", reason: "fetch_failed" });
  return {
    exportedAt: new Date().toISOString(),
    manifest: {
      version: 1,
      scope: "partial_profile_snapshot",
      completeDataRightsExport: false,
      fieldPathFormat: "JSON Pointer",
      included: Object.entries(payload).map(([category, value]) => ({
        category,
        fields: fieldPaths(value, `/${category}`),
      })),
      omitted,
      omissionsExhaustive: false,
      note: "Only returned account, profile, preferences and available school entitlement fields are included. Contact your school for a data-rights review of other records.",
    },
    ...payload,
  };
}
