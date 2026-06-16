import { describe, expect, it } from "vitest";
import { stableSeedId } from "../../prisma/seeds/ids";
import { runSeeds, seedModules } from "../../prisma/seeds/index";

describe("seed skeleton", () => {
  it("registers the approved Sprint 0 seed modules in deterministic order", () => {
    expect(seedModules.map((module) => module.name)).toEqual([
      "00-permissions",
      "01-roles",
      "02-feature-flags",
      "03-entitlements",
      "04-item-types",
      "05-extension-points",
      "06-workflows",
      "07-demo-tenants",
    ]);
  });

  it("runs all seeds in dry-run mode without inserting rows", async () => {
    const results = await runSeeds("all", "dry-run");

    expect(results).toHaveLength(8);

    for (const result of results) {
      expect(result.planned).toBe(0);
      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(0);
    }
  });

  it("creates stable deterministic seed IDs", () => {
    const first = stableSeedId("permission", "course.read");
    const second = stableSeedId("permission", "course.read");
    const different = stableSeedId("permission", "course.create");

    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
