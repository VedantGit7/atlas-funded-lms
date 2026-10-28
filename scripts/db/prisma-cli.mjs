import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The Prisma CLI's entry point, for running it with the current Node
 * (`execFileSync(process.execPath, [prismaCli, ...args])`) instead of through
 * pnpm and a shell. The migration image (atlas-migrate) ships no package
 * manager: pnpm and npm bundle their own copies of packages with advisories.
 * Prisma's package exports don't include the CLI, so follow its `bin`.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = createRequire(join(repoRoot, "package.json")).resolve("prisma/package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin.prisma;

export const prismaCli = join(dirname(manifestPath), bin);
