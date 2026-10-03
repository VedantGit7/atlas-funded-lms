#!/usr/bin/env node
/** Deterministic, browser-safe contracts. Use --check in CI; it never writes. */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { format, resolveConfig } from "prettier";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const targetRoot = join(repoRoot, "frontend/packages/contracts/src");
const slash = (value) => value.replaceAll("\\", "/");
const contractFile =
  /(?:\.(?:schemas|dto|types|contract|events|registry)\.ts$|(?:^|\/)schemas\.ts$|(?:^|-)schemas\.ts$)/;
const excluded =
  /(?:\.service\.ts$|\.repository\.ts$|\.worker\.ts$|page-load\.ts$|resource-loaders\.ts$|\.hall-of-fame)/;

// Inventoried frontend-owned utilities; everything else under src is generated.
// New handwritten files must be reviewed and explicitly recorded here.
const handwritten = new Set([
  "access/permission-guards.ts",
  "item-registry/answer-contracts.ts",
  "item-registry/answer-ui.ts",
  "domain-branding/utils/theme-contrast.ts",
  "domain-branding/utils/theme-css-vars.ts",
  "domain-branding/utils/theme-diff.ts",
  "domain-branding/utils/theme-presets.ts",
]);
const trees = [
  ["backend/apps/api/src/server", "", true],
  ...["branding", "identity", "config", "access"].map((name) => [
    `backend/packages/domain/${name}/src/schemas`,
    `domain-${name}/schemas`,
    false,
  ]),
];
const sourceFiles = [
  [
    "backend/packages/domain/config/src/cost-attribution.catalog.ts",
    "domain-config/cost-attribution.catalog.ts",
  ],
  [
    "backend/packages/domain/branding/src/utils/public-landing-projection.ts",
    "domain-branding/utils/public-landing-projection.ts",
  ],
  [
    "backend/packages/domain/branding/src/utils/theme-semantic-tokens.ts",
    "domain-branding/utils/theme-semantic-tokens.ts",
  ],
  ["backend/packages/membership/src/schemas.ts", "membership/schemas.ts"],
  ["backend/packages/membership/src/schemas/shared.ts", "membership/schemas/shared.ts"],
  [
    "backend/packages/membership/src/schemas/admin-members.ts",
    "membership/schemas/admin-members.ts",
  ],
  [
    "backend/packages/membership/src/notification-preferences.catalog.ts",
    "membership/notification-preferences.catalog.ts",
  ],
  [
    "backend/packages/membership/src/notification-preferences.data.ts",
    "membership/notification-preferences.data.ts",
  ],
  ["backend/packages/events/src/event-types.ts", "events/event-types.ts"],
  ["backend/packages/audit/src/schemas/audit.ts", "audit/audit.ts"],
  [
    "backend/apps/api/src/server/certificates/certificate-design-document.ts",
    "certificates/certificate-design-document.ts",
  ],
  [
    "backend/apps/api/src/server/marketing-workflows/marketing-workflow.graph.ts",
    "marketing-workflows/marketing-workflow.graph.ts",
  ],
];
const rewrites = new Map([
  ["@atlas/membership/schemas/shared", "membership/schemas/shared"],
  ["@atlas/events/event-types", "events/event-types"],
  ["@atlas/access", "access/permission-guards"],
]);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Symbolic links are forbidden in contract trees: ${full}`);
      return entry.isDirectory() ? walk(full) : [full];
    });
}

// Include reexports, import types, import-equals, require and dynamic imports.
function dependencies(content, filename) {
  const source = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
  const found = [];
  const add = (node) => {
    if (!node || !ts.isStringLiteralLike(node))
      throw new Error(`Nonliteral dependency forbidden in ${filename}`);
    found.push({ name: node.text, start: node.getStart(source), end: node.getEnd() });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) add(node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node)) {
      add(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require") ||
        (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "require"))
    )
      add(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function rewrite(content, path) {
  for (const dependency of dependencies(content, path).reverse()) {
    const replacement = rewrites.get(dependency.name);
    if (!replacement) continue;
    let specifier = slash(relative(dirname(path), replacement));
    if (!specifier.startsWith(".")) specifier = `./${specifier}`;
    content =
      content.slice(0, dependency.start) +
      JSON.stringify(specifier) +
      content.slice(dependency.end);
  }
  return content;
}

function validateDependencies(contents) {
  const localConfig = join(dirname(targetRoot), "tsconfig.json");
  const configFile = existsSync(localConfig) ? localConfig : join(repoRoot, "tsconfig.base.json");
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configFile)).options;
  const virtual = new Map(
    [...contents].map(([path, content]) => [resolve(targetRoot, path), content]),
  );
  const directories = new Set();
  for (const path of virtual.keys()) {
    for (let dir = dirname(path); dir !== dirname(dir); dir = dirname(dir)) directories.add(dir);
  }
  const host = {
    ...ts.sys,
    fileExists: (path) => virtual.has(resolve(path)) || ts.sys.fileExists(path),
    readFile: (path) => virtual.get(resolve(path)) ?? ts.sys.readFile(path),
    directoryExists: (path) => directories.has(resolve(path)) || ts.sys.directoryExists(path),
  };
  for (const [path, content] of contents) {
    for (const { name } of dependencies(content, path)) {
      // Zod is the contracts package's only approved external dependency.
      if (name === "zod" || name.startsWith("zod/")) continue;
      const resolved = ts.resolveModuleName(name, join(targetRoot, path), options, host)
        .resolvedModule?.resolvedFileName;
      if (
        !resolved ||
        !virtual.has(resolve(resolved)) ||
        /\.(service|repository|worker)\.[cm]?tsx?$/.test(resolved)
      ) {
        throw new Error(
          `Forbidden or unresolved contract dependency: ${path} -> ${name}${resolved ? ` (${slash(relative(repoRoot, resolved))})` : ""}`,
        );
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check"))
    throw new Error("Usage: node scripts/sync-contracts.mjs [--check]");
  const check = args.includes("--check");
  const expected = new Map();
  const formatting = {
    ...(await resolveConfig(join(repoRoot, "prettier.config.js"))),
    parser: "typescript",
    endOfLine: "lf",
  };
  const add = async (source, target) => {
    if (!existsSync(source) || !statSync(source).isFile())
      throw new Error(`Missing contract source file: ${source}`);
    if (handwritten.has(target) || expected.has(target))
      throw new Error(`Duplicate contract target: ${target}`);
    expected.set(target, await format(rewrite(readFileSync(source, "utf8"), target), formatting));
  };
  for (const [source, target, select] of trees) {
    const sourceRoot = join(repoRoot, source);
    if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory())
      throw new Error(`Missing contract source tree: ${source}`);
    const sources = walk(sourceRoot).filter(
      (file) =>
        file.endsWith(".ts") &&
        (!select ||
          (contractFile.test(slash(relative(sourceRoot, file))) &&
            !excluded.test(slash(relative(sourceRoot, file))))),
    );
    if (!sources.length) throw new Error(`Empty contract source tree: ${source}`);
    for (const file of sources) await add(file, slash(join(target, relative(sourceRoot, file))));
  }
  for (const [source, target] of sourceFiles) await add(join(repoRoot, source), target);
  expected.set(
    "index.ts",
    "/** Auto-synced — run `pnpm sync:contracts` after API schema changes. */\nexport {};\n",
  );
  const all = new Map(expected);
  for (const path of handwritten) {
    if (!existsSync(join(targetRoot, path)))
      throw new Error(`Missing handwritten contract utility: ${path}`);
    all.set(path, readFileSync(join(targetRoot, path), "utf8"));
  }
  validateDependencies(all);
  const drift = [];
  for (const [path, content] of [...expected].sort(([a], [b]) => a.localeCompare(b, "en"))) {
    const target = join(targetRoot, path);
    if (!existsSync(target)) drift.push({ kind: "missing", path, content });
    else if (readFileSync(target, "utf8") !== content)
      drift.push({ kind: "changed", path, content });
  }
  for (const target of walk(targetRoot)) {
    const path = slash(relative(targetRoot, target));
    if (!expected.has(path) && !handwritten.has(path)) drift.push({ kind: "orphan", path });
  }
  for (const { kind, path, content } of drift) {
    console.log(`${kind}: ${path}`);
    if (check) continue;
    const target = join(targetRoot, path);
    if (kind === "orphan") unlinkSync(target);
    else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
    }
  }
  if (check && drift.length) {
    console.error(
      `Contract drift detected (${drift.length} files). Run pnpm sync:contracts and review the changes.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `${check ? "Verified" : "Synced"} ${expected.size} generated contracts; preserved ${handwritten.size} handwritten utilities.`,
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
