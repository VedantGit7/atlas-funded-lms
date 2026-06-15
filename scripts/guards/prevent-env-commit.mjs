import { execSync } from "node:child_process";

const stagedFiles = execSync("git diff --cached --name-only", {
  encoding: "utf8",
})
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean);

const forbiddenEnvFiles = stagedFiles.filter((file) => {
  const normalized = file.replaceAll("\\", "/");
  const fileName = normalized.split("/").at(-1);

  if (!fileName) {
    return false;
  }

  if (fileName === ".env.example") {
    return false;
  }

  return fileName === ".env" || fileName.startsWith(".env.");
});

if (forbiddenEnvFiles.length > 0) {
  console.error("\nBlocked commit: environment secret files must not be committed.\n");
  console.error("Forbidden staged files:");
  for (const file of forbiddenEnvFiles) {
    console.error(`- ${file}`);
  }
  console.error("\nAllowed file:");
  console.error("- .env.example\n");
  process.exit(1);
}

process.exit(0);
