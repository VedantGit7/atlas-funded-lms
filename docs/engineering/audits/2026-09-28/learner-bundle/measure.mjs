import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import process from "node:process";
import console from "node:console";

// Companion evidence only. The unchanged CI guard remains the acceptance check.
const root = "frontend/apps/web/.next-perf";
const server = join(root, "server/app");
const buildId = readFileSync(join(root, "BUILD_ID"), "utf8").trim();
const rootChunks = JSON.parse(readFileSync(join(root, "build-manifest.json"), "utf8")).rootMainFiles;
const shared = new Set(rootChunks);
const chunks = new Map();
function chunk(name) {
  if (chunks.has(name)) return chunks.get(name);
  const buffer = readFileSync(join(root, name));
  const source = buffer.toString();
  const value = {
    name,
    gzipKiB: gzipSync(buffer).length / 1024,
    shared: shared.has(name),
    // String markers are diagnostic hints, not package-size attribution.
    sentryMarker: /captureException|SentryError|sentry.javascript/.test(source),
    motionMarker: /MotionConfigContext|VisualElement|framer-motion/.test(source),
    dompurifyMarker: /DOMPurify|isSupported.*sanitize|sanitize.*isSupported/.test(source),
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
  chunks.set(name, value);
  return value;
}
const routes = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { walk(path); continue; }
    if (!entry.name.endsWith("_client-reference-manifest.js")) continue;
    const route = "/" + relative(server, path).replaceAll("\\", "/")
      .replace(/_client-reference-manifest\.js$/, "").replace(/\/?page$/, "").replace(/\/$/, "");
    if (/^\/(admin|studio|platform|\(admin\)|\(studio\)|\(platform\))(\/|$)/.test(route)) continue;
    const source = readFileSync(path, "utf8");
    let manifest = JSON.parse(source.slice(source.indexOf("=", source.indexOf("__RSC_MANIFEST[")) + 1).trim().replace(/;\s*$/, ""));
    if (typeof manifest === "string") manifest = JSON.parse(manifest);
    const names = new Set(rootChunks);
    for (const files of Object.values(manifest.entryJSFiles)) {
      for (const name of files) names.add(name.replace(/^\/_next\//, ""));
    }
    const items = [...names].map(chunk).sort((a, b) => b.gzipKiB - a.gzipKiB);
    routes.push({ route, gzipKiB: items.reduce((total, item) => total + item.gzipKiB, 0), chunks: items });
  }
}
walk(server);
routes.sort((a, b) => b.gzipKiB - a.gzipKiB);
const sourceFiles = JSON.parse(readFileSync("docs/engineering/audits/2026-09-28/learner-bundle/verification-files.json", "utf8"));
const result = { buildId, measuredAt: new Date().toISOString(), targetKiB: 150,
  accounting: "Unique rootMainFiles plus route entryJSFiles, gzip separately, bytes divided by 1024. Same route exclusions as CI guard. Not a browser transfer trace.",
  sharedKiB: rootChunks.reduce((total, name) => total + chunk(name).gzipKiB, 0), routes,
  sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, createHash("sha256").update(readFileSync(file)).digest("hex")])) };
writeFileSync(process.argv[2] ?? "docs/engineering/audits/2026-09-28/learner-bundle/final-measurements.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ buildId, sharedKiB: result.sharedKiB, routes: routes.length, worst: routes.slice(0, 8).map(({ route, gzipKiB }) => ({ route, gzipKiB })) }, null, 2));
