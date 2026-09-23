import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function compilerArgs() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const [runtime, ...args] = pkg.scripts.typecheck.split(" ");
  expect(runtime, "The compiler needs its own explicit Node heap budget").toBe("node");
  return args as string[];
}

describe("solution typecheck memory budget", () => {
  it("uses a bounded 4 GiB heap even when the parent has a smaller Node default", () => {
    const args = compilerArgs();
    const scriptIndex = args.findIndex((arg) => arg.endsWith("/tsc"));
    expect(scriptIndex).toBeGreaterThan(0);
    const actual = Number(
      execFileSync(
        process.execPath,
        [
          ...args.slice(0, scriptIndex),
          "-e",
          "process.stdout.write(String(require('node:v8').getHeapStatistics().heap_size_limit))",
        ],
        { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=256" } },
      ),
    );
    expect(actual).toBeGreaterThanOrEqual(4 * 1024 ** 3);
    expect(actual).toBeLessThan(4.5 * 1024 ** 3);
  });

  it("still typechecks real projects and rejects genuine compiler errors", () => {
    const args = compilerArgs();
    const fixture = mkdtempSync(join(tmpdir(), "atlas-typecheck-memory-"));
    if (
      dirname(resolve(fixture)) !== resolve(tmpdir()) ||
      !basename(fixture).startsWith("atlas-typecheck-memory-")
    )
      throw new Error("Unsafe fixture cleanup path");
    try {
      writeFileSync(
        join(fixture, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: { strict: true, noEmit: true, types: [], incremental: true },
          files: ["index.ts"],
        }),
      );
      writeFileSync(join(fixture, "index.ts"), "export const value: number = 42;\n");
      const valid = spawnSync(process.execPath, [...args, join(fixture, "tsconfig.json")], {
        encoding: "utf8",
        timeout: 20000,
      });
      expect(valid.status, valid.stdout + valid.stderr).toBe(0);
      writeFileSync(join(fixture, "index.ts"), "export const value: number = 'wrong';\n");
      const invalid = spawnSync(process.execPath, [...args, join(fixture, "tsconfig.json")], {
        encoding: "utf8",
        timeout: 20000,
      });
      expect(invalid.status).not.toBe(0);
      expect(invalid.stdout + invalid.stderr).toContain("TS2322");
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
