#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const slash = (value) => value.replaceAll("\\", "/");
const within = (file, root) =>
  file === root || (!relative(root, file).startsWith("..") && !isAbsolute(relative(root, file)));
function walk(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(root, entry.name);
    return entry.isDirectory() ? walk(file) : /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
  });
}

function packageSources(root) {
  if (!existsSync(root)) return [];
  const current = existsSync(resolve(root, "src")) ? [root] : [];
  return current.concat(
    readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      !["node_modules", "src", "dist"].includes(entry.name)
        ? packageSources(resolve(root, entry.name))
        : [],
    ),
  );
}

export function importsOf(source, filename) {
  const imports = [];
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    const literal =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
          ? node.moduleReference.expression
          : ts.isCallExpression(node) &&
              (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) && node.expression.text === "require"))
            ? node.arguments[0]
            : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
              ? node.argument.literal
              : undefined;
    if (literal && ts.isStringLiteralLike(literal)) imports.push(literal.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return imports;
}

function optionsFor(app, errors) {
  const config = resolve(app, "tsconfig.json");
  const read = ts.readConfigFile(config, ts.sys.readFile);
  if (read.error) {
    errors.push(`Cannot read ${config}`);
    return {};
  }
  // Only compiler options are needed; source coverage is explicitly walked below.
  // Avoid enumerating generated Next build/type trees through tsconfig includes.
  return ts.parseJsonConfigFileContent(read.config, { ...ts.sys, readDirectory: () => [] }, app)
    .options;
}

function candidates(specifier, file, options) {
  if (specifier.startsWith(".") || isAbsolute(specifier))
    return [resolve(dirname(file), specifier)];
  const result = [];
  for (const [pattern, targets] of Object.entries(options.paths ?? {})) {
    const star = pattern.indexOf("*");
    if (
      star === -1
        ? pattern !== specifier
        : !(
            specifier.startsWith(pattern.slice(0, star)) &&
            specifier.endsWith(pattern.slice(star + 1))
          )
    )
      continue;
    const match =
      star === -1 ? "" : specifier.slice(star, specifier.length - (pattern.length - star - 1));
    for (const target of targets)
      result.push(resolve(options.baseUrl ?? options.pathsBasePath, target.replaceAll("*", match)));
  }
  return result;
}

export function checkServerAuthority(repoRoot) {
  const errors = [];
  const web = resolve(repoRoot, "frontend/apps/web");
  const api = resolve(repoRoot, "backend/apps/api");
  const webSrc = resolve(web, "src");
  const apiSrc = resolve(api, "src");
  const forbiddenTrees = ["server", "events", "worker", "app/api/v1"];
  const webFiles = walk(webSrc);
  const apiFiles = walk(apiSrc);
  if (!webFiles.length) errors.push("Web source tree missing or empty");
  if (
    !apiFiles.some((file) =>
      slash(relative(apiSrc, file)).match(/^app\/api\/v1\/.+\/route\.[jt]s$/),
    )
  )
    errors.push("No canonical backend API routes found");
  for (const file of webFiles) {
    const local = slash(relative(webSrc, file));
    if (
      forbiddenTrees.some((tree) => local.startsWith(`${tree}/`)) ||
      /^modules\/diagnostics\/.*\.(?:service|repository|resource-loaders)\.ts$/.test(local) ||
      local === "lib/server/public-auth-orchestrator.ts"
    ) {
      errors.push(`${local}: business operations belong in the authoritative backend`);
    }
  }
  const packages = ["frontend/packages", "backend/packages"].flatMap((path) =>
    packageSources(resolve(repoRoot, path)),
  );
  for (const [app, files, forbiddenApps] of [
    [web, webFiles, [api]],
    [api, apiFiles, [web]],
    ...packages.map((pkg) => [pkg, walk(resolve(pkg, "src")), [web, api]]),
  ]) {
    if (!files.length) continue;
    const options = existsSync(resolve(app, "tsconfig.json"))
      ? optionsFor(app, errors)
      : optionsFor(web, errors);
    for (const file of files) {
      for (const specifier of importsOf(readFileSync(file, "utf8"), file)) {
        const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule
          ?.resolvedFileName;
        const targets = candidates(specifier, file, options);
        if (resolved) targets.push(resolve(resolved));
        if (
          (app !== api && /^@atlas\/(?:api-server|contracts-modules)(?:\/|$)/.test(specifier)) ||
          targets.some((target) => forbiddenApps.some((otherApp) => within(target, otherApp)))
        ) {
          errors.push(
            `${slash(relative(repoRoot, file))}: application boundary crossed by ${specifier}`,
          );
        }
      }
    }
  }
  return {
    errors,
    webFiles: webFiles.length,
    apiFiles: apiFiles.length,
    packages: packages.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkServerAuthority(resolve(import.meta.dirname, "../.."));
  if (result.errors.length) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      `Server authority passed (${result.webFiles} web files, ${result.apiFiles} backend files, ${result.packages} shared packages).`,
    );
}
