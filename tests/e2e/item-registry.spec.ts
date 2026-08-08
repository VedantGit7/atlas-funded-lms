import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

const itemRegistryPaths = [
  "app/studio/items/page.tsx",
  "app/studio/items/[id]/page.tsx",
  "app/studio/item-collections/page.tsx",
  "app/admin/extensions/page.tsx",
  "features/item-registry/components/item-bank-table.tsx",
  "features/item-registry/components/item-editor-form.tsx",
  "features/item-registry/components/item-collections-table.tsx",
  "features/extensions/components/extensions-admin.tsx",
  "app/api/v1/item-types/route.ts",
  "app/api/v1/items/route.ts",
  "app/api/v1/items/[id]/route.ts",
  "app/api/v1/items/[id]/dimension-weights/route.ts",
  "app/api/v1/item-collections/route.ts",
  "app/api/v1/item-collections/[id]/route.ts",
  "app/api/v1/item-collections/[id]/items/route.ts",
  "app/api/v1/extension-points/route.ts",
  "app/api/v1/extensions/registrations/route.ts",
];

describe("item registry e2e wiring", () => {
  it("includes approved item bank, editor, collections, and extensions screens", () => {
    for (const relativePath of itemRegistryPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("uses StudioShell nav entries for items and collections", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/StudioShell.tsx"), "utf8");
    expect(source).toContain("/studio/items");
    expect(source).toContain("/studio/item-collections");
  });

  it("does not send tenant_id from item editor form", () => {
    const source = readFileSync(
      resolve(webRoot, "features/item-registry/components/item-editor-form.tsx"),
      "utf8",
    );
    expect(source).toContain("/api/v1/items");
    expect(source).not.toMatch(/tenant_id|tenantId/);
  });

  it("registers swipe renderer from extensions admin", () => {
    const source = readFileSync(
      resolve(webRoot, "features/extensions/components/extensions-admin.tsx"),
      "utf8",
    );
    expect(source).toContain("item_type_renderer");
    expect(source).toContain("swipe");
  });

  it("handles denied states on item bank page", () => {
    const source = readFileSync(resolve(webRoot, "app/studio/items/page.tsx"), "utf8");
    expect(source).toContain("denied");
  });
});
