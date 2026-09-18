import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

describe("platform tenant cache isolation", () => {
  it("platform query keys never reuse tenant query key helper", () => {
    const source = readFileSync(
      resolve(webRoot, "features/platform/platform-query-keys.ts"),
      "utf8",
    );
    expect(source).toContain("platformQueryKey");
    expect(source).not.toContain("tenantQueryKey");
  });

  it("platform shell client does not mount tenant branding", () => {
    const source = readFileSync(
      resolve(webRoot, "components/shells/PlatformConsoleShellClient.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/branding|tenant-admin-shell|PublicTenantBranding/i);
  });
});
