import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * Every API route handler and the metadata object it is built with.
 *
 * For each `route.ts` under the app router and each exported HTTP method, find
 * the `metadata:` the handler is constructed with and follow it through local
 * constants, imports, re-exports (including `export { x as routeMetadata }`),
 * spreads and property access (`routeMetadata.PUT`) to the object literal, then
 * read its string fields.
 *
 * Parsed with the TypeScript compiler rather than regular expressions: the
 * regex audit guard this replaced had five separate blind spots (first match
 * only, case-sensitive names, missing scan roots, verb-keyed objects judged by
 * their first verb, aliased re-exports collapsed into one name) that each let
 * real routes go unchecked.
 */

const root = process.cwd();
const appRoot = join(root, "backend/apps/api/src/app");

export const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const METHODS = new Set(["GET", "HEAD", "OPTIONS", ...MUTATIONS]);

/** The string-valued fields of a metadata object (permission, audit, mfa, …). */
export type MetadataFields = Record<string, string>;

export type RouteBinding = {
  /** e.g. `/api/v1/items/[id]` */
  route: string;
  method: string;
  file: string;
  /** null when the handler's metadata could not be followed to an object literal. */
  metadata: MetadataFields | null;
  /** Where that object literal is written, as `path:line`. */
  definedAt: string | null;
};

type Found = { fields: MetadataFields; definedAt: string };

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sourceCache = new Map<string, ts.SourceFile | null>();
function source(file: string): ts.SourceFile | null {
  if (!sourceCache.has(file)) {
    sourceCache.set(
      file,
      existsSync(file)
        ? ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true)
        : null,
    );
  }
  return sourceCache.get(file) ?? null;
}

/** The API app's path aliases (`@atlas/api-server/*` and friends), as the compiler sees them. */
let aliasCache: { baseUrl: string; paths: Record<string, string[]> } | null = null;
function apiAliases() {
  if (!aliasCache) {
    const configFile = join(root, "backend/apps/api/tsconfig.json");
    const { config } = ts.readConfigFile(configFile, ts.sys.readFile) as {
      config?: { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
    };
    aliasCache = {
      baseUrl: resolve(dirname(configFile), config?.compilerOptions?.baseUrl ?? "."),
      paths: config?.compilerOptions?.paths ?? {},
    };
  }
  return aliasCache;
}

function resolveAlias(specifier: string): string | null {
  const { baseUrl, paths } = apiAliases();
  for (const [pattern, targets] of Object.entries(paths)) {
    const target = targets[0];
    if (!target) continue;
    if (!pattern.includes("*")) {
      if (pattern === specifier) return join(baseUrl, target);
      continue;
    }
    const prefix = pattern.slice(0, pattern.indexOf("*"));
    if (specifier.startsWith(prefix)) {
      // A tsconfig path target has at most one "*"; replaceAll says so plainly.
      return join(baseUrl, target.replaceAll("*", specifier.slice(prefix.length)));
    }
  }
  return null;
}

/** Module specifier -> file, for relative paths, the API's path aliases and @atlas packages. */
function resolveModule(fromFile: string, specifier: string): string | null {
  const aliased = specifier.startsWith(".") ? null : resolveAlias(specifier);
  let base: string | null = null;
  if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else if (aliased) base = aliased.replace(/\.tsx?$/, "");
  else {
    const match = /^@atlas\/([^/]+)(?:\/(.+))?$/.exec(specifier);
    if (match?.[1]) {
      const packageDir = join(root, "backend/packages", match[1]);
      if (!match[2]) base = join(packageDir, "src/index");
      else {
        try {
          const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
            exports?: Record<string, string>;
          };
          const target = manifest.exports?.[`./${match[2]}`];
          base = target ? join(packageDir, target) : join(packageDir, "src", match[2]);
        } catch {
          base = join(packageDir, "src", match[2]);
        }
      }
    }
  }
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** What an expression evaluates to, as far as static reading can tell. */
type Resolved = { object: ts.ObjectLiteralExpression; file: string };

function resolveToObject(expression: ts.Expression, file: string, depth: number): Resolved | null {
  if (depth > 8) return null;
  const node = unwrap(expression);
  if (ts.isObjectLiteralExpression(node)) return { object: node, file };
  if (ts.isIdentifier(node)) return resolveName(node.text, file, depth + 1);
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const key = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : ts.isStringLiteralLike(node.argumentExpression)
        ? node.argumentExpression.text
        : null;
    if (key == null) return null;
    const owner = resolveToObject(node.expression, file, depth + 1);
    if (!owner) return null;
    for (const property of owner.object.properties) {
      if (ts.isPropertyAssignment(property) && propertyName(property.name) === key) {
        return resolveToObject(property.initializer, owner.file, depth + 1);
      }
      if (ts.isShorthandPropertyAssignment(property) && property.name.text === key) {
        return resolveName(key, owner.file, depth + 1);
      }
    }
  }
  return null;
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText();
}

function resolveName(name: string, file: string, depth: number): Resolved | null {
  const sf = source(file);
  if (!sf) return null;
  for (const statement of sf.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name &&
          declaration.initializer
        )
          return resolveToObject(declaration.initializer, file, depth);
      }
    }
    if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings) {
      const named = statement.importClause.namedBindings;
      if (!ts.isNamedImports(named)) continue;
      for (const element of named.elements) {
        if (element.name.text !== name) continue;
        const target = resolveModule(file, (statement.moduleSpecifier as ts.StringLiteral).text);
        return target
          ? resolveName((element.propertyName ?? element.name).text, target, depth + 1)
          : null;
      }
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && statement.exportClause) {
      if (!ts.isNamedExports(statement.exportClause)) continue;
      for (const element of statement.exportClause.elements) {
        if (element.name.text !== name) continue;
        const target = resolveModule(file, (statement.moduleSpecifier as ts.StringLiteral).text);
        return target
          ? resolveName((element.propertyName ?? element.name).text, target, depth + 1)
          : null;
      }
    }
  }
  return null;
}

function readFields(resolved: Resolved, depth = 0): MetadataFields {
  const fields: MetadataFields = {};
  if (depth > 8) return fields;
  for (const property of resolved.object.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = resolveToObject(property.expression, resolved.file, depth + 1);
      if (spread) {
        for (const [key, value] of Object.entries(readFields(spread, depth + 1))) {
          fields[key] ??= value;
        }
      }
      continue;
    }
    if (!ts.isPropertyAssignment(property)) continue;
    const value = unwrap(property.initializer);
    if (ts.isStringLiteralLike(value)) fields[propertyName(property.name)] = value.text;
  }
  return fields;
}

/** `metadata: X` inside a handler's construction (createTenantRoute, createPlatformRoute, …). */
function metadataIn(node: ts.Node, file: string): Found | null {
  let found: Found | null = null;
  const visit = (child: ts.Node) => {
    if (found) return;
    if (
      ts.isPropertyAssignment(child) &&
      propertyName(child.name) === "metadata" &&
      !ts.isFunctionLike(child.initializer)
    ) {
      const resolved = resolveToObject(child.initializer, file, 0);
      if (resolved) {
        const sf = resolved.object.getSourceFile();
        const line = sf.getLineAndCharacterOfPosition(resolved.object.getStart(sf)).line + 1;
        found = {
          fields: readFields(resolved),
          definedAt: `${relativeFile(resolved.file)}:${String(line)}`,
        };
        return;
      }
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/**
 * The method's metadata, also when the handler is built in a module-level
 * constant that the exported method calls
 * (`const suspend = createPlatformRoute({ metadata, … })` then
 * `export async function POST(req, ctx) { return suspend(req, ctx); }`).
 */
function methodMetadata(node: ts.Node, sf: ts.SourceFile, file: string): Found | null {
  const direct = metadataIn(node, file);
  if (direct) return direct;
  const referenced = new Set<string>();
  const collect = (child: ts.Node) => {
    if (ts.isIdentifier(child)) referenced.add(child.text);
    ts.forEachChild(child, collect);
  };
  collect(node);
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        referenced.has(declaration.name.text) &&
        declaration.initializer &&
        declaration.initializer !== node
      ) {
        const found = metadataIn(declaration.initializer, file);
        if (found) return found;
      }
    }
  }
  return null;
}

let cached: RouteBinding[] | null = null;

export function routeBindings(): RouteBinding[] {
  if (cached) return cached;
  const result: RouteBinding[] = [];
  for (const file of walk(join(appRoot, "api"))) {
    if (!/[/\\]route\.tsx?$/.test(file)) continue;
    const route = `/${relative(appRoot, dirname(file)).replaceAll("\\", "/")}`;
    const sf = source(file);
    if (!sf) continue;
    for (const statement of sf.statements) {
      const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const method = declaration.name.getText();
          if (!METHODS.has(method) || !declaration.initializer) continue;
          const found = methodMetadata(declaration.initializer, sf, file);
          result.push({
            route,
            method,
            file,
            metadata: found?.fields ?? null,
            definedAt: found?.definedAt ?? null,
          });
        }
      } else if (
        ts.isFunctionDeclaration(statement) &&
        statement.name &&
        METHODS.has(statement.name.text)
      ) {
        const found = methodMetadata(statement, sf, file);
        result.push({
          route,
          method: statement.name.text,
          file,
          metadata: found?.fields ?? null,
          definedAt: found?.definedAt ?? null,
        });
      }
    }
  }
  cached = result;
  return result;
}

export function isPublicRoute(route: string): boolean {
  return route.startsWith("/api/v1/public/");
}

export function isPlatformRoute(route: string): boolean {
  return route.startsWith("/api/v1/platform/");
}

export function relativeFile(file: string): string {
  return relative(root, file).replaceAll("\\", "/");
}
