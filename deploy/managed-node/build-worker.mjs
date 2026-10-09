// Bundles the worker for its runtime image: run from the repository root.
//
//   node deploy/managed-node/build-worker.mjs <outdir>
//
// The worker used to run its TypeScript source through tsx, so the image
// carried the whole monorepo: source, every workspace's dependencies (Next,
// frontend libraries, build tools) and dev dependencies, about 1.5 GB. This
// bundles the worker and its own dependencies into a few ES modules instead.
//
// Only playwright-core stays a real package: it starts Chromium from files
// beside its own code. The Dockerfile installs it next to the bundle.
import process from "node:process";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";

const outdir = process.argv[2];
if (!outdir) throw new Error("Usage: node deploy/managed-node/build-worker.mjs <outdir>");
mkdirSync(outdir, { recursive: true });

/**
 * css-tree (reached through jsdom, which sanitizes SVG uploads) ships an ES
 * module build that loads its JSON data through createRequire(import.meta.url).
 * A bundler cannot follow that, so in a bundle those requires look beside the
 * bundle and fail. Its CommonJS build requires the same files statically, so
 * resolve every import of css-tree to that build, which also keeps one copy.
 */
const cssTreeCommonJs = {
  name: "css-tree-commonjs",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^css-tree(\/.*)?$/ }, async (args) => {
      if (args.kind === "require-call" || args.pluginData?.cssTreeCommonJs) return undefined;
      const resolved = await pluginBuild.resolve(args.path, {
        kind: "require-call",
        resolveDir: args.resolveDir,
        importer: args.importer,
        pluginData: { cssTreeCommonJs: true },
      });
      return resolved.errors.length > 0 ? undefined : { path: resolved.path };
    });
  },
};

/**
 * jsdom reads two things beside its own code when its modules load, neither
 * of which exists beside a bundle:
 * - its default stylesheet (fs.readFileSync on a path from __dirname), which
 *   is inlined here as a string;
 * - the file for synchronous XMLHttpRequest (require.resolve), which nothing
 *   here uses. It becomes a path that fails only if a synchronous request is
 *   ever made.
 * Each replacement must match, so a jsdom upgrade that changes either fails
 * this build rather than the worker.
 */
const jsdomFiles = {
  name: "jsdom-files",
  setup(pluginBuild) {
    const replaceOnce = (contents, from, to, file) => {
      if (!contents.includes(from)) {
        throw new Error(`jsdom changed: "${from}" not found in ${file}; update build-worker.mjs`);
      }
      return contents.replace(from, to);
    };
    pluginBuild.onLoad(
      {
        filter:
          /[\\/]jsdom[\\/]lib[\\/]jsdom[\\/]living[\\/]css[\\/]helpers[\\/]computed-style\.js$/,
      },
      async (args) => {
        const source = await readFile(args.path, "utf8");
        const stylesheetPath = resolve(
          dirname(args.path),
          "../../../browser/default-stylesheet.css",
        );
        const stylesheet = await readFile(stylesheetPath, "utf8");
        return {
          loader: "js",
          contents: replaceOnce(
            source,
            `fs.readFileSync(\n  path.resolve(__dirname, "../../../browser/default-stylesheet.css"),\n  { encoding: "utf-8" }\n)`,
            JSON.stringify(stylesheet),
            args.path,
          ),
        };
      },
    );
    pluginBuild.onLoad(
      { filter: /[\\/]jsdom[\\/]lib[\\/]jsdom[\\/]living[\\/]xhr[\\/]XMLHttpRequest-impl\.js$/ },
      async (args) => ({
        loader: "js",
        contents: replaceOnce(
          await readFile(args.path, "utf8"),
          `require.resolve("./xhr-sync-worker.js")`,
          JSON.stringify("jsdom-synchronous-xhr-is-not-bundled"),
          args.path,
        ),
      }),
    );
  },
};

const result = await build({
  entryPoints: {
    worker: "backend/apps/api/src/worker/index.ts",
    "check-worker-imports": "deploy/managed-node/check-worker-imports.ts",
    "check-worker-runtime": "deploy/managed-node/check-worker-runtime.ts",
    // Operator maintenance that renders certificates, so needs this image's Chromium.
    "rerender-certificate-pdfs": "scripts/data/rerender-certificate-pdfs.ts",
  },
  outdir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node24",
  tsconfig: "backend/apps/api/tsconfig.json",
  external: ["playwright-core"],
  plugins: [cssTreeCommonJs, jsdomFiles],
  // Bundled CommonJS dependencies still call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __atlasCreateRequire } from 'node:module'; const require = __atlasCreateRequire(import.meta.url);",
  },
  logLevel: "warning",
  metafile: true,
});

/**
 * A bundle has no package.json files, so an image scanner cannot see which
 * libraries are inside it, and the container scan in CI would stop reporting
 * a vulnerable one. Record each bundled package's name and version as a
 * package.json under bundled-packages/node_modules, where scanners look (Trivy
 * reads package.json files under node_modules when scanning an image; it
 * ignores lockfiles there). Nothing resolves modules from that directory.
 */
async function writeBundledPackageManifests() {
  const packages = new Map();
  for (const input of Object.keys(result.metafile.inputs)) {
    const match = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input);
    if (!match) continue;
    const manifest = JSON.parse(await readFile(join(match[1], "package.json"), "utf8"));
    if (manifest.name && manifest.version) {
      packages.set(`${manifest.name}@${manifest.version}`, {
        name: manifest.name,
        version: manifest.version,
        ...(manifest.license ? { license: manifest.license } : {}),
      });
    }
  }
  // A second version of a name gets its own nested directory, as npm would install it.
  const seen = new Map();
  for (const manifest of packages.values()) {
    const index = seen.get(manifest.name) ?? 0;
    seen.set(manifest.name, index + 1);
    const nested = index === 0 ? "" : `.v${String(index)}/node_modules/`;
    const directory = join(outdir, "bundled-packages", "node_modules", nested, manifest.name);
    mkdirSync(directory, { recursive: true });
    await writeFile(join(directory, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return packages.size;
}

const bundledPackages = await writeBundledPackageManifests();
const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
process.stdout.write(
  `${JSON.stringify({
    build: "worker-bundle",
    outputs: Object.keys(result.metafile.outputs).length,
    bundledPackages,
    megabytes: Number((bytes / 1e6).toFixed(1)),
  })}
`,
);
