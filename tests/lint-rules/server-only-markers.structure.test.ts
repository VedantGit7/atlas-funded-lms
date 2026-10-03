import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../frontend/apps/web/src");

describe("web server authority and browser boundaries (F18 / M9)", () => {
  it("retires poisoned duplicate business implementations", () => {
    for (const tree of ["server", "events", "worker", "app/api/v1"]) {
      expect(existsSync(resolve(root, tree)), tree).toBe(false);
    }
  });
  it.each(["lib/api/server.ts", "lib/server/public-auth-fetch.ts"])(
    "poisons the privileged HTTP adapter %s against client imports",
    (file) => {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source).toContain('import "server-only";');
      expect(source).not.toMatch(/^\s*["']use client["']/m);
    },
  );
});
