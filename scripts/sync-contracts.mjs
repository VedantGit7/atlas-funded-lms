#!/usr/bin/env node
/**
 * Sync Zod schema / DTO / type files into @atlas/contracts (no Prisma / DB).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const targetRoot = join(repoRoot, "frontend/packages/contracts/src");

const CONTRACT_FILE =
  /(?:\.(?:schemas|dto|types|contract|events|registry)\.ts$|(?:^|\/)schemas\.ts$|(?:^|-)schemas\.ts$|lesson-schemas\.ts$)/;

const EXCLUDE =
  /(?:\.service\.ts$|\.repository\.ts$|\.worker\.ts$|page-load\.ts$|resource-loaders\.ts$|\.hall-of-fame)/;

function walkContractFiles(dir, baseForExclude = dir) {
  const files = [];
  if (!existsSync(dir)) {
    return files;
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walkContractFiles(full, baseForExclude));
      continue;
    }
    if (!full.endsWith(".ts")) {
      continue;
    }
    const rel = relative(baseForExclude, full).replaceAll("\\", "/");
    if (EXCLUDE.test(rel)) {
      continue;
    }
    if (CONTRACT_FILE.test(rel)) {
      files.push(full);
    }
  }
  return files;
}

function walkAllTs(dir) {
  const files = [];
  if (!existsSync(dir)) {
    return files;
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walkAllTs(full));
      continue;
    }
    if (full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

function rewriteContent(content, targetRelPath) {
  const depth = targetRelPath.split("/").length - 1;
  const up = "../".repeat(depth);
  return content
    .replaceAll("@atlas/membership/schemas/shared", `${up}membership/schemas/shared`)
    .replaceAll("@atlas/events/event-types", `${up}events/event-types`)
    .replaceAll("@atlas/access", `${up}access/permission-guards`);
}

function copyFileToTarget(source, targetSubpath) {
  const target = join(targetRoot, targetSubpath);
  mkdirSync(dirname(target), { recursive: true });
  const content = rewriteContent(readFileSync(source, "utf8"), targetSubpath.replaceAll("\\", "/"));
  writeFileSync(target, content, "utf8");
  return 1;
}

function copyTree(sourceRoot, targetSubdir, mode = "contract") {
  const files = mode === "all" ? walkAllTs(sourceRoot) : walkContractFiles(sourceRoot);
  let copied = 0;
  for (const source of files) {
    const rel = relative(sourceRoot, source);
    copied += copyFileToTarget(source, join(targetSubdir, rel).replaceAll("\\", "/"));
  }
  return copied;
}

let copied = 0;
copied += copyTree(join(repoRoot, "backend/apps/api/src/server"), "");
copied += copyTree(join(repoRoot, "backend/packages/domain/branding/src/schemas"), "domain-branding/schemas", "all");
copied += copyFileToTarget(
  join(repoRoot, "backend/packages/domain/branding/src/utils/public-landing-projection.ts"),
  "domain-branding/utils/public-landing-projection.ts",
);
copied += copyTree(join(repoRoot, "backend/packages/domain/identity/src/schemas"), "domain-identity/schemas", "all");
copied += copyTree(join(repoRoot, "backend/packages/domain/config/src/schemas"), "domain-config/schemas", "all");
copied += copyTree(join(repoRoot, "backend/packages/domain/access/src/schemas"), "domain-access/schemas", "all");
copied += copyFileToTarget(
  join(repoRoot, "backend/packages/membership/src/schemas.ts"),
  "membership/schemas.ts",
);
copied += copyFileToTarget(
  join(repoRoot, "backend/packages/membership/src/schemas/shared.ts"),
  "membership/schemas/shared.ts",
);
copied += copyFileToTarget(
  join(repoRoot, "backend/packages/membership/src/schemas/admin-members.ts"),
  "membership/schemas/admin-members.ts",
);
copied += copyFileToTarget(
  join(repoRoot, "backend/packages/domain/branding/src/utils/theme-semantic-tokens.ts"),
  "domain-branding/utils/theme-semantic-tokens.ts",
);
copied += copyFileToTarget(
  join(repoRoot, "backend/packages/events/src/event-types.ts"),
  "events/event-types.ts",
);
copied += copyFileToTarget(
  join(repoRoot, "backend/packages/audit/src/schemas/audit.ts"),
  "audit/audit.ts",
);

writeFileSync(
  join(targetRoot, "index.ts"),
  `/** Auto-synced — run \`pnpm sync:contracts\` after API schema changes. */\nexport {};\n`,
  "utf8",
);

console.log(`Synced ${copied} contract files to frontend/packages/contracts/src`);
