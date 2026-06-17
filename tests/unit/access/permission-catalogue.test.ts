import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@atlas/access";

describe("permission catalogue seed", () => {
  it("has unique permission keys", () => {
    const keys = PERMISSIONS.map((permission) => permission.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not define empty descriptions or resource types", () => {
    for (const permission of PERMISSIONS) {
      expect(permission.key).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
      expect(permission.description.length).toBeGreaterThan(3);
      expect(permission.resourceType.length).toBeGreaterThan(1);
    }
  });

  it("keeps platform permissions marked platformOnly", () => {
    for (const permission of PERMISSIONS.filter((p) => p.key.startsWith("platform."))) {
      expect(permission.platformOnly).toBe(true);
    }
  });
});
