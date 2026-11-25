/** The most senior system role first. */
const ROLE_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["owner", "Owner"],
  ["admin", "Administrator"],
  ["instructor", "Instructor"],
  ["moderator", "Moderator"],
  ["learner", "Learner"],
];

/**
 * The role shown under a member's name in the Admin and Studio headers: their
 * most senior role, not the panel they are in (QA review 1 m4 showed an
 * Administrator as "Instructor" in Studio). A custom role reads "Team member".
 */
export function primaryRoleLabel(roleKeys: readonly string[] | null | undefined): string {
  const keys = new Set((roleKeys ?? []).map((key) => key.toLowerCase()));
  for (const [key, label] of ROLE_LABELS) {
    if (keys.has(key)) return label;
  }
  return keys.size > 0 ? "Team member" : "Member";
}
