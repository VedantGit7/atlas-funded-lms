import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const apiRoots = ["apps/web/src/app/api", "apps/web/app/api"];

function walkFiles(directory) {
  try {
    const entries = readdirSync(directory);
    const files = [];

    for (const entry of entries) {
      const path = join(directory, entry);
      const stat = statSync(path);

      if (stat.isDirectory()) {
        files.push(...walkFiles(path));
        continue;
      }

      files.push(path);
    }

    return files;
  } catch {
    return [];
  }
}

function hasRouteMetadataExport(content) {
  return (
    /export\s+const\s+routeMetadata\s*=/.test(content) ||
    /export\s*\{\s*routeMetadata\s*\}/.test(content)
  );
}

function hasCoLocatedRouteMetadata(routeFile) {
  const metadataFile = routeFile.replace(/route\.(ts|tsx)$/, "route.metadata.$1");

  if (!existsSync(metadataFile)) {
    return false;
  }

  return hasRouteMetadataExport(readFileSync(metadataFile, "utf8"));
}

const routeFiles = apiRoots
  .flatMap((root) => walkFiles(root))
  .filter((file) => /[/\\]route\.(ts|tsx)$/.test(file));

const failures = [];

for (const file of routeFiles) {
  const content = readFileSync(file, "utf8");
  const hasRouteMetadata = hasRouteMetadataExport(content) || hasCoLocatedRouteMetadata(file);

  if (!hasRouteMetadata) {
    failures.push(file);
  }
}

if (failures.length > 0) {
  console.error("\nBlocked push: API route files must export routeMetadata.\n");
  for (const file of failures) {
    console.error(`- ${file}`);
  }
  console.error("\nEvery approved API route must declare route metadata before handlers run.\n");
  process.exit(1);
}

process.exit(0);
