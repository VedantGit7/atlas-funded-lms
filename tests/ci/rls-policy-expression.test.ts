import { describe, expect, it } from "vitest";
import { isCanonicalTenantSettingPolicy } from "../../scripts/db/rls-policy-expression";

const canonical =
  "(tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)";

describe("catalog tenant-setting policy recognition", () => {
  it("accepts the exact null-safe UUID equality emitted by PostgreSQL", () => {
    expect(isCanonicalTenantSettingPolicy(canonical)).toBe(true);
  });

  it.each([
    ["missing USING", null],
    ["unconditional access", "true"],
    ["unsafe trailing OR", `(${canonical} OR true)`],
    ["unsafe leading OR", `(true OR ${canonical})`],
    ["tenant null escape", `(${canonical} OR (tenant_id IS NULL))`],
    ["unrelated setting", canonical.replace("app.tenant_id", "app.actor_membership_id")],
    ["inequality", canonical.replace("tenant_id =", "tenant_id <>")],
    ["wrong column", canonical.replace("tenant_id =", "membership_id =")],
    ["unbound function call", "NULLIF(current_setting('app.tenant_id', true), '')::uuid"],
    ["textual occurrence only", `(true OR ('${canonical}' IS NOT NULL))`],
    ["arbitrary extra expression", `${canonical} AND true`],
    ["conservative AND rejection", `(${canonical} AND false)`],
    ["comment containing the scope", `true /* ${canonical} */`],
    ["comment suffix", `${canonical} /* reviewed */`],
  ])("does not exempt %s", (_name, expression) => {
    expect(isCanonicalTenantSettingPolicy(expression)).toBe(false);
  });
});
