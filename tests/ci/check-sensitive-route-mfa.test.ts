import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  STEP_UP_MFA_OPERATIONS,
  STEP_UP_MFA_PERMISSIONS,
} from "../../backend/packages/authorization/src/step-up-mfa-policy";

describe("check-sensitive-route-mfa CI guard (audit H4)", () => {
  it("passes: every step-up operation declares mfa: required", () => {
    const output = execFileSync("pnpm", ["ci:mfa-metadata"], {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: true,
    }).toString();
    expect(output).toMatch(/policy satisfied/);
  });

  it("covers the operations audit H4 named", () => {
    for (const permission of [
      "role.assign",
      "membership.remove",
      "tenancy.domain.manage",
      "data.export.run",
    ])
      expect(STEP_UP_MFA_PERMISSIONS).toHaveProperty(permission);
    const routes = STEP_UP_MFA_OPERATIONS.map(
      (operation) => `${operation.method} ${operation.route}`,
    );
    expect(routes).toEqual(
      expect.arrayContaining([
        "PUT /api/v1/marketing/integrations/snippets",
        "POST /api/v1/learner-billing/payment-gateways",
        "PUT /api/v1/learner-billing/payment-gateways/[id]",
      ]),
    );
  });

  it("gives every listed operation a reason, and lists none twice", () => {
    const keys = STEP_UP_MFA_OPERATIONS.map(
      (operation) => `${operation.method} ${operation.route}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(STEP_UP_MFA_OPERATIONS.every((operation) => operation.reason.length > 10)).toBe(true);
  });
});
