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
    // Same correction as moderation.structure.test.ts: the blanket ban on any
    // /admin href read the capability-gated "Review & Approvals" entry as a
    // leak. `filterModerationNavigation` drops it without
    // `canAccessWorkflowReview`, so the requirement is that privileged hrefs
    // are gated — not that the string is absent. Audit and platform stay
    // banned outright.
    expect(nav).not.toMatch(/\/platform|\/moderate\/audit/);

    const privilegedHrefs = [...nav.matchAll(/href:\s*"(\/admin[^"]*)"/g)];
    for (const [, href] of privilegedHrefs) {
      const entry = nav.slice(nav.indexOf(`"${href}"`));
      const untilNextEntry = entry.slice(0, entry.indexOf("},"));
      expect(untilNextEntry, `${href} must be capability-gated`).toMatch(/requires\w+:\s*true/);
    }
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
