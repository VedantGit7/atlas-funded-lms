import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it.each([
  "atlas-landing/AtlasPlatformLanding.tsx",
  "atlas-landing/AtlasLandingSections.tsx",
  "landing/TenantPublicLanding.tsx",
  "landing/LandingSections.tsx",
])("keeps static landing content on the server: %s", (file) => {
  const source = readFileSync(`frontend/apps/web/src/features/public/components/${file}`, "utf8");
  expect(source).not.toMatch(/^["']use client["'];/);
});
