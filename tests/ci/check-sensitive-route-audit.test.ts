import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("check-sensitive-route-audit CI guard", () => {
  it("passes for approved route metadata", () => {
    expect(() => {
      execFileSync("pnpm", ["ci:audit-metadata"], {
        cwd: process.cwd(),
        stdio: "pipe",
        shell: true,
      });
    }).not.toThrow();
  });
});
