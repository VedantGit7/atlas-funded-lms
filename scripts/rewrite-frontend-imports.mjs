import fs from "node:fs";
import path from "node:path";

const root = path.resolve("frontend/apps/web/src");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;

    const original = fs.readFileSync(full, "utf8");
    let next = original;
    next = next.replace(
      /from (['"])(?:\.\.\/)+server\//g,
      (_, quote) => `from ${quote}@atlas/contracts/`,
    );
    next = next.replace(
      /from (['"])(?:\.\.\/)+modules\/diagnostics\//g,
      (_, quote) => `from ${quote}@atlas/contracts-modules/diagnostics/`,
    );
    next = next.replace(
      /from (['"])(?:\.\.\/)+modules\//g,
      (_, quote) => `from ${quote}@atlas/contracts-modules/`,
    );
    if (next !== original) {
      fs.writeFileSync(full, next);
      console.log("updated", full);
    }
  }
}

walk(root);
