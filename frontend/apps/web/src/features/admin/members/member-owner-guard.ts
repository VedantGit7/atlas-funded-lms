type MemberRole = {
  key: string;
};

export function memberHasOwnerRole(roles: MemberRole[] | undefined): boolean {
  return roles?.some((role) => role.key === "owner") ?? false;
}
