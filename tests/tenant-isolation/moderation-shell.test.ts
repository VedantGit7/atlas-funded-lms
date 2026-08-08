import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

describe("moderation shell tenant isolation wiring", () => {
  it("includes moderation shell gate and route registry", () => {
    expect(existsSync(resolve(webRoot, "components/shells/ModerationShellGate.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "features/moderation/moderation-route-registry.ts"))).toBe(
      true,
    );
    expect(existsSync(resolve(webRoot, "features/moderation/moderation-query-keys.ts"))).toBe(true);
  });

  it("moderation navigation never includes audit admin or platform routes", () => {
    const nav = readFileSync(
      resolve(webRoot, "features/moderation/moderation-navigation.ts"),
      "utf8",
    );
    expect(nav).not.toMatch(/\/admin|\/platform|\/moderate\/audit/);
  });

  it("moderation query keys isolate tenant scopes", () => {
    const source = readFileSync(
      resolve(webRoot, "features/moderation/moderation-query-keys.ts"),
      "utf8",
    );
    expect(source).toContain("tenantQueryKey");
  });

  it("moderation shell context enforces community entitlement before navigation", () => {
    const source = readFileSync(resolve(webRoot, "lib/server/moderation-shell-context.ts"), "utf8");
    expect(source).toContain("community.enable");
    expect(source).toContain("entitlement_blocked");
  });
});
