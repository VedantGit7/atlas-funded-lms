import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * A standalone Next.js image that is wrong in layout still builds and only
 * fails when the container starts, or serves pages whose assets all 404
 * (docs/runbooks/standalone-build-output.md). These checks read the Dockerfile
 * so a broken layout fails in seconds instead of after a deploy.
 */
const dockerfile = readFileSync("deploy/managed-node/Dockerfile", "utf8");

/** Each stage's instructions, keyed by its `AS` name, with continuations joined. */
function stages(source) {
  const result = new Map();
  let current = null;
  for (const line of source.replace(/\\\r?\n\s*/g, " ").split(/\r?\n/)) {
    const from = /^FROM\s+(\S+)\s+AS\s+(\S+)/i.exec(line);
    if (from) {
      current = { base: from[1], lines: [] };
      result.set(from[2], current);
    } else if (current && line.trim() && !line.trimStart().startsWith("#")) {
      current.lines.push(line.trim());
    }
  }
  return result;
}

const byName = stages(dockerfile);

test("builds the web app from the shared dependencies with its own build secret", () => {
  const build = byName.get("web-build");
  assert.ok(build, "web-build stage");
  assert.equal(build.base, "dependencies");
  assert.ok(build.lines.includes("COPY --from=source /source/ ./"));
  const run = build.lines.find((line) => line.startsWith("RUN"));
  assert.match(run, /--mount=type=secret,id=web_build_env,required=true/);
  assert.match(
    run,
    /pnpm exec dotenv -e \/run\/secrets\/web_build_env -- pnpm --filter @atlas\/web build$/,
  );
  // Build settings must never be baked into a layer.
  assert.equal(
    build.lines.some((line) => /^(COPY|ADD)\b.*\.env/.test(line)),
    false,
  );
});

test("ships the web standalone tree with its static assets and public files", () => {
  const web = byName.get("web");
  assert.ok(web, "web stage");
  assert.equal(web.base, "runtime-base");
  const copies = web.lines.filter((line) => line.startsWith("COPY --from=web-build"));
  assert.deepEqual(copies, [
    "COPY --from=web-build --chown=node:node /app/frontend/apps/web/.next/standalone ./",
    "COPY --from=web-build --chown=node:node /app/frontend/apps/web/.next/static ./frontend/apps/web/.next/static",
    "COPY --from=web-build --chown=node:node /app/frontend/apps/web/public ./frontend/apps/web/public",
  ]);
  // The standalone entrypoint keeps the workspace path, not .next/standalone/server.js.
  assert.ok(web.lines.includes('CMD ["node", "frontend/apps/web/server.js"]'));
});

test("runs the web image like the API: unprivileged, no package managers, clean shutdown", () => {
  const web = byName.get("web");
  const api = byName.get("api");
  for (const line of [
    "WORKDIR /app",
    "ENV NODE_ENV=production",
    "ENV HOSTNAME=0.0.0.0",
    // Above Traefik's 90 s default idle-connection time, so the proxy closes first.
    "ENV KEEP_ALIVE_TIMEOUT=100000",
    "USER node",
    "STOPSIGNAL SIGTERM",
  ]) {
    assert.ok(web.lines.includes(line), line);
    assert.ok(api.lines.includes(line), `api: ${line}`);
  }
  assert.ok(web.lines.includes("ENV PORT=3000"));
  assert.ok(web.lines.includes("EXPOSE 3000"));
  const cleanup = web.lines.find((line) => line.startsWith("RUN rm"));
  assert.equal(
    cleanup,
    api.lines.find((line) => line.startsWith("RUN rm")),
  );
  // USER comes after every COPY, so nothing runs or is copied as root afterwards.
  const user = web.lines.indexOf("USER node");
  assert.ok(web.lines.slice(user).every((line) => !/^(COPY|RUN)\b/.test(line)));
});

test("ships the health probe in every runtime image, root-owned and before USER", () => {
  const copy = "COPY --from=source /source/deploy/managed-node/healthcheck.mjs ./healthcheck.mjs";
  for (const name of ["web", "api", "worker"]) {
    const stage = byName.get(name);
    const at = stage.lines.indexOf(copy);
    assert.ok(at >= 0, `${name} copies healthcheck.mjs`);
    assert.ok(at < stage.lines.indexOf("USER node"), `${name} copies it before USER`);
  }
});

test("ships the migration job with only what applying the schema needs, unprivileged", () => {
  const migrate = byName.get("migrate");
  assert.ok(migrate, "migrate stage");
  assert.equal(migrate.base, "dependencies");
  const copied = migrate.lines
    .filter((line) => line.startsWith("COPY"))
    .map((line) => line.split(/\s+/)[2]);
  // The schema, migrations, SQL and their scripts; never the apps or the whole tree.
  assert.deepEqual(copied.sort(), [
    "/source/backend/prisma",
    "/source/backend/prisma.config.ts",
    "/source/scripts/db",
    "/source/scripts/guards/check-migrate-status.mjs",
  ]);
  // No package manager: npm and pnpm bundle copies of packages outside the
  // lockfile, and the job runs Prisma with node.
  const cleanup = migrate.lines.find((line) => line.startsWith("RUN rm -rf"));
  for (const path of ["/usr/local/lib/node_modules/npm", "/usr/local/lib/node_modules/corepack"])
    assert.ok(cleanup?.includes(path), `removes ${path}`);
  for (const path of ["/root/.cache", "/usr/local/bin/pnpm", "/usr/local/bin/npm"])
    assert.ok(cleanup?.includes(path), `removes ${path}`);
  const user = migrate.lines.indexOf("USER node");
  assert.ok(user > -1, "runs as node");
  assert.ok(migrate.lines.slice(user).every((line) => !/^(COPY|RUN)\b/.test(line)));
  assert.ok(migrate.lines.includes('ENTRYPOINT ["node", "scripts/db/migration-job.mjs"]'));
});
