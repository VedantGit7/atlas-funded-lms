import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The metering path must stay reachable from a route.
 *
 * `enforceEntitlement` was written with a `usageContext` parameter, an atomic
 * counter behind it, and an integration suite proving the arithmetic — and no
 * caller anywhere. `create-tenant-route.ts` invoked it without usage, and
 * `RouteMetadata` had no field to declare any, so quantitative limits could be
 * configured but never applied to a request. The mechanism was complete and
 * unreachable.
 *
 * That is the same shape as the six unwired test suites and the two verification
 * harnesses this repo has already been bitten by, so it gets the same treatment:
 * a structural assertion that the wire exists.
 */

const repoRoot = resolve(import.meta.dirname, "../..");

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

const WRAPPER = "backend/packages/api/src/create-tenant-route.ts";
const METADATA = "backend/packages/api/src/route-metadata.ts";
const ENFORCE = "backend/packages/authorization/src/enforce-entitlement.ts";

describe("entitlement metering is wired to the route wrapper", () => {
  it("declares a usage field routes can set", () => {
    const source = read(METADATA);
    expect(source).toContain("entitlementUsage?:");
    expect(source).toContain("EntitlementUsageFn");
  });

  it("calls the meter from the tenant route pipeline", () => {
    // Without this call the field is decorative and the counter never moves.
    expect(read(WRAPPER)).toContain("consumeEntitlementUnits(");
  });

  it("passes the route's own usage function rather than a constant", () => {
    expect(read(WRAPPER)).toContain("args.metadata.entitlementUsage(");
  });

  it("meters after the permission decision, not before", () => {
    // A caller who is about to be denied must not burn a unit of the tenant's
    // quota on the way out — that is a denial-of-service against the tenant
    // paying for the plan.
    const source = read(WRAPPER);
    const decision = source.indexOf("if (!decision.allowed)");
    const meter = source.indexOf("consumeEntitlementUnits(");
    expect(decision).toBeGreaterThan(-1);
    expect(meter).toBeGreaterThan(decision);
  });

  it("gates before the permission decision", () => {
    // The capability check is not a metering concern and stays where it was.
    const source = read(WRAPPER);
    expect(source.indexOf("enforceEntitlement(")).toBeLessThan(
      source.indexOf("if (!decision.allowed)"),
    );
  });
});

describe("the capability gate reads the stored value", () => {
  it("parses value_json on every call, not only when units are supplied", () => {
    // The bug: the parse sat behind an early return for requests with no usage
    // context — which was every request — so `{ "enabled": false }` still
    // granted access.
    const source = read(ENFORCE);
    const gate = source.slice(
      source.indexOf("export async function enforceEntitlement"),
      source.indexOf("export async function consumeEntitlementUnits"),
    );
    expect(gate).toContain("parseEntitlementValue");
    expect(gate).toContain("EntitlementRequiredError");
  });

  it("keeps the gate free of usage arguments", () => {
    const source = read(ENFORCE);
    const gate = source.slice(
      source.indexOf("export async function enforceEntitlement"),
      source.indexOf("export async function consumeEntitlementUnits"),
    );
    expect(gate).not.toContain("units");
  });
});

describe("at least one route actually meters", () => {
  it("has a live call site, so the path is exercised in production code", () => {
    // The whole failure being guarded against is a mechanism with no caller.
    // If these routes stop metering, another one must take their place.
    const metered = [
      "backend/apps/api/src/app/api/v1/gamification/export/route.metadata.ts",
      "backend/apps/api/src/app/api/v1/me/rewards/redeem/route.metadata.ts",
    ].filter((path) => read(path).includes("entitlementUsage:"));

    expect(metered.length).toBeGreaterThan(0);
  });

  it("meters only routes that declare an entitlement to meter against", () => {
    // entitlementUsage without an entitlement key charges nothing to nothing.
    for (const path of [
      "backend/apps/api/src/app/api/v1/gamification/export/route.metadata.ts",
      "backend/apps/api/src/app/api/v1/me/rewards/redeem/route.metadata.ts",
    ]) {
      const source = read(path);
      if (!source.includes("entitlementUsage:")) continue;
      expect(source).toMatch(/entitlement:\s*"[^"]+"/);
    }
  });
});
