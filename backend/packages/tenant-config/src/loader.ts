import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTenantManifest } from "./schema";
import type { TenantManifest } from "./types";

export function resolveManifestPath(tenantSlug: string, configsRoot?: string): string {
  const root = configsRoot ?? resolve(process.cwd(), "configs", "tenants");
  return resolve(root, tenantSlug, "manifest.json");
}

export function loadTenantManifest(tenantSlug: string, configsRoot?: string): TenantManifest {
  const manifestPath = resolveManifestPath(tenantSlug, configsRoot);
  const raw = readFileSync(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  return parseTenantManifest(parsed);
}

export function loadTenantManifestFromFile(manifestPath: string): TenantManifest {
  const raw = readFileSync(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  return parseTenantManifest(parsed);
}
