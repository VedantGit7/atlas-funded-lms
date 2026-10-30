// Bundles the global catalogue seed for the migration job's image: run from the
// repository root.
//
//   node deploy/managed-node/build-migrate-seed.mjs <outdir>
//
// The migration job (scripts/db/migration-job.mjs) seeds the platform-wide
// catalogues after applying the schema: without the permission catalogue every
// permission check fails, and only a seed fills it. The seed is TypeScript in
// the workspace packages, which the image does not ship, so it ships as one ES
// module instead, as the worker does (build-worker.mjs). Its packages are a
// subset of the dependency layer the image already carries, so an image scanner
// still sees each of them there.
import process from "node:process";
import { mkdirSync } from "node:fs";
import { build } from "esbuild";

const outdir = process.argv[2];
if (!outdir) throw new Error("Usage: node deploy/managed-node/build-migrate-seed.mjs <outdir>");
mkdirSync(outdir, { recursive: true });

const result = await build({
  entryPoints: { "global-catalogues": "backend/prisma/seeds/global-catalogues.ts" },
  outdir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  tsconfig: "backend/prisma/seeds/tsconfig.json",
  // Bundled CommonJS dependencies still call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __atlasCreateRequire } from 'node:module'; const require = __atlasCreateRequire(import.meta.url);",
  },
  logLevel: "warning",
  metafile: true,
});

const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
process.stdout.write(
  `${JSON.stringify({
    build: "migrate-seed-bundle",
    outputs: Object.keys(result.metafile.outputs).length,
    megabytes: Number((bytes / 1e6).toFixed(1)),
  })}
`,
);
