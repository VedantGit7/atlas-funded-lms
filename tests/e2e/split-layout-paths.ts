import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const repoRoot = resolve(import.meta.dirname, "../..");
export const webRoot = resolve(repoRoot, "frontend/apps/web/src");
export const apiRoot = resolve(repoRoot, "backend/apps/api/src");

const apiRelativePrefixes = ["app/api/", "server/", "events/"] as const;

export function resolveSplitPath(relativePath: string): string {
  if (apiRelativePrefixes.some((prefix) => relativePath.startsWith(prefix))) {
    return resolve(apiRoot, relativePath);
  }

  return resolve(webRoot, relativePath);
}

export function splitPathExists(relativePath: string): boolean {
  return existsSync(resolveSplitPath(relativePath));
}
