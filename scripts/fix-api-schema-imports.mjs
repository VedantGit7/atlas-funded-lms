import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../backend/apps/api/src/app");

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!full.endsWith(".ts")) {
      continue;
    }
    const content = readFileSync(full, "utf8");
    const next = content.replace(
      /from ["'](?:\.\.\/)+features\/(assessments|item-registry)\//g,
      'from "@atlas/api-server/$1/',
    );
    if (next !== content) {
      writeFileSync(full, next, "utf8");
    }
  }
}

walk(root);
console.log("Fixed API schema imports");
