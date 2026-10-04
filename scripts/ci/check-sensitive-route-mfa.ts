import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import {
  STEP_UP_MFA_OPERATIONS,
  STEP_UP_MFA_PERMISSIONS,
} from "../../backend/packages/authorization/src/step-up-mfa-policy";

/**
 * Step-up MFA must be declared wherever the policy says it is due (audit H4).
 *
 * For every tenant API route and HTTP method, find the metadata object the
 * handler is built with, following imports, and read its `permission` and
 * `mfa`. Then:
 *
 * - a mutation declaring a permission in STEP_UP_MFA_PERMISSIONS must require MFA;
 * - every route/method in STEP_UP_MFA_OPERATIONS must exist and require MFA.
 *
 * Parsed with the TypeScript compiler rather than regular expressions: the
 * audit guard beside this one records three separate regex blind spots (first
 * match only, case-sensitive names, missing scan roots) that each let real
 * routes go unchecked.
 */

const root = process.cwd();
const appRoot = join(root, "backend/apps/api/src/app");
const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const METHODS = new Set(["GET", ...MUTATIONS]);

type Metadata = { permission: string | null; mfa: string | null };
type Binding = { route: string; method: string; file: string; metadata: Metadata | null };

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

/** Module specifier -> file, for relative paths and this repo's @atlas packages. */
function resolveModule(fromFile: string, specifier: string): string | null {
  let base: string | null = null;
  if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
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

function readObject(object: ts.ObjectLiteralExpression, file: string, depth: number): Metadata {
  const result: Metadata = { permission: null, mfa: null };
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = resolveExpression(property.expression, file, depth + 1);
      if (spread) {
        result.permission ??= spread.permission;
        result.mfa ??= spread.mfa;
      }
      continue;
    }
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name.getText();
    const value = unwrap(property.initializer);
    if (!ts.isStringLiteralLike(value)) continue;
    if (name === "permission") result.permission = value.text;
    if (name === "mfa") result.mfa = value.text;
  }
  return result;
}

/** The metadata an expression evaluates to: an object literal, or a name bound to one. */
function resolveExpression(expression: ts.Expression, file: string, depth = 0): Metadata | null {
  if (depth > 6) return null;
  const node = unwrap(expression);
  if (ts.isObjectLiteralExpression(node)) return readObject(node, file, depth);
  if (ts.isIdentifier(node)) return resolveName(node.text, file, depth + 1);
  return null;
}

function resolveName(name: string, file: string, depth: number): Metadata | null {
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
          return resolveExpression(declaration.initializer, file, depth);
      }
    }
    if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings) {
      const bindings = statement.importClause.namedBindings;
      if (!ts.isNamedImports(bindings)) continue;
      for (const element of bindings.elements) {
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

/** `metadata: X` inside a handler's construction (createTenantRoute, runProtectedTenantRouteHandler, …). */
function metadataIn(node: ts.Node, file: string): Metadata | null {
  let found: Metadata | null = null;
  const visit = (child: ts.Node) => {
    if (found) return;
    if (
      ts.isPropertyAssignment(child) &&
      child.name.getText() === "metadata" &&
      !ts.isFunctionLike(child.initializer)
    ) {
      found = resolveExpression(child.initializer, file);
      if (found) return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function bindings(): Binding[] {
  const result: Binding[] = [];
  for (const file of walk(join(appRoot, "api"))) {
    if (!/[/\\]route\.tsx?$/.test(file)) continue;
    const route = `/${relative(appRoot, dirname(file)).replaceAll("\\", "/")}`;
    // Not tenant step-up territory: anonymous routes, and the platform plane,
    // where assertPlatformMfa already requires MFA for every operation.
    if (route.startsWith("/api/v1/public/") || route.startsWith("/api/v1/platform/")) continue;
    const sf = source(file);
    if (!sf) continue;
    for (const statement of sf.statements) {
      const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const method = declaration.name.getText();
          if (!METHODS.has(method) || !declaration.initializer) continue;
          result.push({ route, method, file, metadata: metadataIn(declaration.initializer, file) });
        }
      } else if (
        ts.isFunctionDeclaration(statement) &&
        statement.name &&
        METHODS.has(statement.name.text)
      ) {
        result.push({
          route,
          method: statement.name.text,
          file,
          metadata: metadataIn(statement, file),
        });
      }
    }
  }
  return result;
}

const all = bindings();
const resolved = all.filter((binding) => binding.metadata?.permission);
const violations: string[] = [];
const where = (binding: Binding) => `${binding.method} ${binding.route}`;

for (const binding of resolved) {
  const permission = binding.metadata?.permission ?? "";
  if (!MUTATIONS.has(binding.method) || !(permission in STEP_UP_MFA_PERMISSIONS)) continue;
  if (binding.metadata?.mfa !== "required")
    violations.push(
      `${where(binding)}: ${permission} is a step-up permission; declare mfa: "required"`,
    );
}

for (const operation of STEP_UP_MFA_OPERATIONS) {
  const binding = all.find((b) => b.route === operation.route && b.method === operation.method);
  if (!binding) {
    violations.push(
      `${operation.method} ${operation.route}: listed in STEP_UP_MFA_OPERATIONS but no such route`,
    );
  } else if (!binding.metadata) {
    violations.push(
      `${where(binding)}: listed for step-up MFA but its metadata could not be resolved`,
    );
  } else if (binding.metadata.mfa !== "required") {
    violations.push(`${where(binding)}: ${operation.reason} Declare mfa: "required"`);
  }
}

// Vacuity guard: a scan that resolves nothing proves nothing.
if (all.length < 600 || resolved.length / all.length < 0.9) {
  console.error(
    `\nBlocked CI: resolved metadata for ${String(resolved.length)} of ${String(all.length)} ` +
      "tenant route methods; the route layout or metadata shape has changed and this guard is no longer checking.\n",
  );
  process.exit(1);
}

if (violations.length > 0) {
  console.error("\nBlocked CI: sensitive operations must require step-up MFA (audit H4).\n");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error(
    "\nPolicy: backend/packages/authorization/src/step-up-mfa-policy.ts. Routes declare it in metadata.\n",
  );
  process.exit(1);
}

console.log(
  `Step-up MFA: ${String(resolved.length)}/${String(all.length)} tenant route methods resolved; policy satisfied.`,
);
