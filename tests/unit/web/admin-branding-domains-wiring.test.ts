import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../../apps/web/src");

const adminComponentPaths = [
  "app/admin/branding/_components/BrandingEditor.tsx",
  "app/admin/branding/_components/BrandPreview.tsx",
  "app/admin/branding/_components/BrandingVersionHistory.tsx",
  "app/admin/domains/_components/DomainStatusPanel.tsx",
  "app/admin/domains/_components/AddDomainDialog.tsx",
  "lib/server-api.ts",
  "lib/client-api.ts",
  "app/admin/branding/_components/default-theme.ts",
];

describe("admin branding and domains screen wiring", () => {
  it("includes the approved T6 and T7 component and loader files", () => {
    for (const relativePath of adminComponentPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });
});
