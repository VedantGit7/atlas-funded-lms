import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { auditMetadataViolations } from "../../scripts/ci/lib/audit-metadata-policy";
import { routeBindings, type RouteBinding } from "../../scripts/ci/lib/route-metadata-bindings";

describe("check-sensitive-route-audit CI guard", () => {
  it("passes for approved route metadata", () => {
    expect(() => {
      execFileSync("pnpm", ["ci:audit-metadata"], {
        cwd: process.cwd(),
        stdio: "pipe",
        shell: true,
      });
    }).not.toThrow();
  });
});

/** Audit M7: every mutation is audited or states why not. */
describe("audit metadata policy", () => {
  const binding = (
    method: string,
    route: string,
    metadata: Record<string, string> | null,
  ): RouteBinding => ({
    method,
    route,
    file: `backend/apps/api/src/app${route}/route.ts`,
    metadata,
    definedAt: null,
  });
  const check = (bindings: RouteBinding[]) => auditMetadataViolations(bindings, {});

  it("accepts an audited mutation, an exempt learner action and any read", () => {
    expect(
      check([
        binding("PUT", "/api/v1/items/[id]", { permission: "item.update", audit: "required" }),
        binding("POST", "/api/v1/attempts/[id]/answers", {
          permission: "attempt.submit",
          audit: "none",
          auditExempt: "learner_activity",
        }),
        binding("GET", "/api/v1/items", { permission: "item.read", audit: "none" }),
      ]),
    ).toEqual([]);
  });

  it("refuses a mutation with audit none and no stated reason", () => {
    const [violation] = check([
      binding("PUT", "/api/v1/items/[id]", { permission: "item.update", audit: "none" }),
    ]);
    expect(violation).toContain("no auditExempt reason");
  });

  it("refuses an exemption on a sensitive permission", () => {
    const [violation] = check([
      binding("POST", "/api/v1/roles", {
        permission: "role.create",
        audit: "none",
        auditExempt: "own_preferences",
      }),
    ]);
    expect(violation).toContain("cannot be exempt");
  });

  it("refuses an unknown reason, and required together with an exemption", () => {
    const violations = check([
      binding("POST", "/api/v1/x", {
        permission: "item.update",
        audit: "none",
        auditExempt: "because",
      }),
      binding("POST", "/api/v1/y", {
        permission: "item.update",
        audit: "required",
        auditExempt: "read_only",
      }),
    ]);
    expect(violations).toHaveLength(2);
  });

  it("refuses a mutation whose metadata cannot be resolved, unless listed", () => {
    const unresolved = binding("POST", "/api/v1/mystery", null);
    expect(check([unresolved])[0]).toContain("could not be resolved");
    expect(
      auditMetadataViolations([unresolved], { "POST /api/v1/mystery": "signed webhook" }),
    ).toEqual([]);
  });

  it("refuses a listed route that no longer exists", () => {
    expect(auditMetadataViolations([], { "POST /api/v1/gone": "old webhook" })[0]).toContain(
      "no such route",
    );
  });

  it("requires every platform mutation to be audited", () => {
    const [violation] = check([
      binding("POST", "/api/v1/platform/tenants/[id]/suspend", {
        permission: "platform.tenant.manage",
        audit: "none",
        auditExempt: "read_only",
      }),
    ]);
    expect(violation).toContain("platform mutation");
  });

  it("ignores anonymous public routes", () => {
    expect(check([binding("POST", "/api/v1/public/security/csp-report", null)])).toEqual([]);
  });
});

/**
 * The resolver against the real route tree, one case per blind spot of the
 * regex scan it replaced. Each of these was invisible to the old guard.
 */
describe("route metadata resolution", () => {
  const all = routeBindings();
  const find = (method: string, route: string) =>
    all.find((entry) => entry.method === method && entry.route === route);

  it("reads the right verb of a verb-keyed metadata object", () => {
    expect(find("PUT", "/api/v1/tenant-settings/admin-otp")?.metadata).toMatchObject({
      permission: "config.update",
      audit: "required",
    });
  });

  it("follows an aliased re-export to its own definition", () => {
    expect(find("GET", "/api/v1/payments/orders/[orderId]")?.metadata?.["audit"]).toBe("none");
  });

  it("follows the API's path aliases", () => {
    expect(find("POST", "/api/v1/manage/learners/[id]/archive")?.metadata).toMatchObject({
      permission: "membership.suspend",
      mfa: "required",
    });
  });

  it("follows a handler built in a module constant", () => {
    expect(find("POST", "/api/v1/platform/tenants/[id]/suspend")?.metadata?.["permission"]).toBe(
      "platform.tenant.manage",
    );
  });

  it("covers the mutations the audit named", () => {
    for (const [method, route] of [
      ["POST", "/api/v1/assessments"],
      ["PUT", "/api/v1/items/[id]"],
      ["PUT", "/api/v1/item-collections/[id]"],
      ["PUT", "/api/v1/notification-templates"],
      ["PUT", "/api/v1/automation-rules"],
      ["PUT", "/api/v1/locales/[locale]"],
      ["POST", "/api/v1/fx/rates"],
    ] as const) {
      expect(find(method, route)?.metadata?.["audit"], `${method} ${route}`).toBe("required");
    }
  });
});
