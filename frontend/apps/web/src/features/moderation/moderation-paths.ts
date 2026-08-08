export const ADMIN_MODERATION_CASES_PATH = "/admin/moderation/cases";
export const ADMIN_MODERATION_APPEALS_PATH = "/admin/moderation/appeals";

export function adminModerationCaseDetailPath(caseId: string): string {
  return `${ADMIN_MODERATION_CASES_PATH}/${caseId}`;
}
