import { vi } from "vitest";

/**
 * A `$queryRaw` for `can()`, which reads the permission catalogue, overrides
 * and role grants in one statement. Tests describe those three result sets as
 * the separate lookups return them; this folds them into that statement's row.
 * Omitted sets are empty.
 */
export function authorizationFactsQuery(
  permission: Array<{ key: string }>,
  overrides: Array<{ effect: string; permission_key?: string }> = [],
  grants: Array<{ role_key: string; bypasses_resource_predicates?: boolean }> = [],
) {
  return vi.fn().mockResolvedValueOnce([
    {
      permission_exists: permission.length > 0,
      override_effect: overrides[0]?.effect ?? null,
      role_keys: [...new Set(grants.map((grant) => grant.role_key))],
      bypasses_resource_predicates: grants.some(
        (grant) => grant.bypasses_resource_predicates === true,
      ),
    },
  ]);
}
