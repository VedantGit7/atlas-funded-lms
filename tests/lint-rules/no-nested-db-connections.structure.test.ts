import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * No connection-holding callback may open another (audit H3).
 *
 * `withGlobalDb` and `withTenantTx` share one pool. Opening one inside the
 * other's callback holds two connections per request, and at DATABASE_POOL_MAX
 * concurrent requests every request holds one and waits for another forever.
 * `createTenantRoute` measured 0 successful requests at 20 concurrent before it
 * was un-nested; 40 more sites (public pages, webhooks, auth, downloads) still
 * had the pattern when this check was added.
 *
 * This catches the pattern where it is written. Indirect nesting (a helper
 * that opens its own transaction, called from inside a callback) is caught at
 * runtime by backend/packages/db/src/connection-scope.ts, which fails tests.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const HOLDERS = new Set(["withGlobalDb", "withTenantTx"]);

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist", "generated"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(path);
  }
  return files;
}

function nestedSites(file: string): string[] {
  const text = readFileSync(file, "utf8");
  if (!/withGlobalDb|withTenantTx/.test(text)) return [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const sites: string[] = [];
  const visit = (node: ts.Node, holding: string | null) => {
    let next = holding;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (HOLDERS.has(name)) {
        if (holding) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          sites.push(
            `${relative(repoRoot, file).replaceAll("\\", "/")}:${String(line + 1)} ${name} inside ${holding}`,
          );
        }
        next = name;
      }
    }
    ts.forEachChild(node, (child) => {
      visit(child, next);
    });
  };
  visit(source, null);
  return sites;
}

describe("pooled connections", () => {
  it("are never acquired inside another connection's callback", () => {
    const sites = [
      "backend/apps",
      "backend/packages",
      "frontend/apps",
      "frontend/packages",
      "scripts",
    ].flatMap((directory) => sourceFiles(join(repoRoot, directory)).flatMap(nestedSites));
    expect(sites).toEqual([]);
  });

  it("detects the pattern it guards against", () => {
    const probe = join(repoRoot, "backend/packages/db/src/connection-scope.ts");
    const fixture = ts.createSourceFile(
      probe,
      "withGlobalDb(async (db) => { await withTenantTx(ctx, async (tx) => 1); });",
      ts.ScriptTarget.Latest,
      true,
    );
    let found = false;
    const visit = (node: ts.Node, holding: boolean) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        HOLDERS.has(node.expression.text)
      ) {
        if (holding) found = true;
        holding = true;
      }
      ts.forEachChild(node, (child) => {
        visit(child, holding);
      });
    };
    visit(fixture, false);
    expect(found).toBe(true);
  });
});
