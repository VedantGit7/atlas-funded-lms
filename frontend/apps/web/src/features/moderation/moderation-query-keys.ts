import { clearClientDataCache, tenantQueryKey } from "../../lib/query/client-data-cache";

export type ModerationCasesFilter = {
  status?: string;
  view?: "cases" | "appeals";
};

export function moderationCasesQueryKey(
  scope: string,
  filter: ModerationCasesFilter = {},
): readonly unknown[] {
  return tenantQueryKey(scope, ["moderation", "cases", filter]);
}

export function moderationCaseDetailQueryKey(scope: string, caseId: string): readonly unknown[] {
  return tenantQueryKey(scope, ["moderation", "case", caseId]);
}

export function moderationAppealsQueryKey(scope: string): readonly unknown[] {
  return tenantQueryKey(scope, ["moderation", "appeals"]);
}

export function moderationSpacesQueryKey(scope: string): readonly unknown[] {
  return tenantQueryKey(scope, ["moderation", "spaces"]);
}

export function invalidateModerationCaches(scope: string): void {
  void moderationCasesQueryKey(scope);
  void moderationCaseDetailQueryKey(scope, "case");
  void moderationAppealsQueryKey(scope);
  void moderationSpacesQueryKey(scope);
  clearClientDataCache("membership_failure");
}
