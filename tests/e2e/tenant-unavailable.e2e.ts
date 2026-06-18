import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

describe("tenant unavailable e2e wiring", () => {
  it("includes tenant unavailable screen and component", () => {
    expect(existsSync(resolve(webRoot, "app/(public)/tenant-unavailable/page.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "components/patterns/errors/TenantUnavailable.tsx"))).toBe(
      true,
    );
  });

  it("shows request id and safe branding only", () => {
    const source = readFileSync(
      resolve(webRoot, "components/patterns/errors/TenantUnavailable.tsx"),
      "utf8",
    );
    expect(source).toContain("Request ID");
    expect(source).not.toMatch(/membership|protected nav|LearnerShell/i);
  });

  it("redirects unavailable tenants from auth layout", () => {
    const source = readFileSync(resolve(webRoot, "app/(auth)/layout.tsx"), "utf8");
    expect(source).toContain("/tenant-unavailable");
    expect(source).toContain("runTenantStateGate");
  });
});
