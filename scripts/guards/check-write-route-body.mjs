import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { findWriteRoutesReadingQuery } from "./lib/write-route-body.mjs";

// Fails when a POST, PUT, PATCH or DELETE route reads its data from the URL
// query (`input:`) instead of the request body (`body:`). See the library for
// why this matters.

const apiRoot = "backend/apps/api/src/app/api";

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const failures = walk(apiRoot)
  .filter((file) => /[/\\]route\.tsx?$/.test(file))
  .flatMap((file) =>
    findWriteRoutesReadingQuery(readFileSync(file, "utf8")).map(
      (finding) =>
        `${relative(process.cwd(), file).replaceAll("\\", "/")}:${String(finding.line)} ` +
        `${finding.method} passes "${finding.value}" as input: (read from the URL query). ` +
        `Use body: for request data, or name the schema *QuerySchema if it really is a query.`,
    ),
  );

if (failures.length > 0) {
  console.error("Write routes that read their data from the URL query instead of the body:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("Write route body check passed: every write route reads its data from the body.");
