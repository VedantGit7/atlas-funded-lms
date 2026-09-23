const generatedDirectories = new Set([
  "node_modules",
  ".next",
  ".next-e2e",
  ".next-perf",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);

/** Skip whole generated directories before traversal, including alternate Next build outputs. */
export function isGeneratedSourcePath(path) {
  return path
    .replaceAll("\\", "/")
    .split("/")
    .some((part) => generatedDirectories.has(part));
}
