const generatedDirectories = new Set([
  "node_modules",
  ".next",
  ".next-e2e",
  ".next-perf",
  "dist",
  "build",
  ".turbo",
]);

/** Coverage reports live at repository/workspace roots, never inside product source. */
export function isCoverageOutputPath(path) {
  return /^(?:coverage|(?:backend|frontend)\/(?:apps|packages)\/[^/]+\/coverage|backend\/packages\/domain\/[^/]+\/coverage)(?:\/|$)/.test(
    path.replaceAll("\\", "/").replace(/^\.\//, ""),
  );
}

/** Skip whole generated directories before traversal, including alternate Next build outputs. */
export function isGeneratedSourcePath(path) {
  return (
    isCoverageOutputPath(path) ||
    path
      .replaceAll("\\", "/")
      .split("/")
      .some((part) => generatedDirectories.has(part))
  );
}
