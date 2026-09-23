import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const contract = JSON.parse(readFileSync(new URL("./required-jobs.json", import.meta.url), "utf8"));
const blockers = [];
let needs = {};
try {
  needs = JSON.parse(process.env.CI_NEEDS_JSON ?? "");
  if (!needs || Array.isArray(needs) || typeof needs !== "object") throw new Error("Invalid needs");
} catch {
  needs = {};
  blockers.push("Invalid or absent CI_NEEDS_JSON");
}
const sha = process.env.GITHUB_SHA ?? "";
let actualSha = "";
try {
  actualSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (
    execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      encoding: "utf8",
      stdio: "pipe",
    }).trim()
  )
    blockers.push("Candidate checkout is dirty");
} catch {
  blockers.push("Cannot establish checkout identity");
}
if (!/^[a-f0-9]{40}$/.test(sha) || sha !== actualSha)
  blockers.push("Candidate SHA does not match checkout");
if (process.env.GITHUB_ACTIONS !== "true")
  blockers.push("CI evidence requires a GitHub Actions run");
const id = process.env.GITHUB_RUN_ID ?? "",
  attempt = process.env.GITHUB_RUN_ATTEMPT ?? "";
if (!/^[1-9]\d*$/.test(id) || !/^[1-9]\d*$/.test(attempt))
  blockers.push("Missing or invalid run identity");
const repository = process.env.GITHUB_REPOSITORY ?? "";
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) blockers.push("Missing repository identity");
const expected = new Set([...contract.requiredJobs, ...contract.optionalJobs]);
for (const key of Object.keys(needs))
  if (!expected.has(key)) blockers.push(`Unregistered job: ${key}`);
const gates = [...expected].map((job) => {
  const status = needs[job]?.result ?? "missing";
  const optional = contract.optionalJobs.includes(job);
  if (status !== "success" && !(optional && status === "skipped"))
    blockers.push(`${job}: ${status}`);
  return { id: job, status, required: !optional };
});
const evidence = {
  schemaVersion: "1",
  evidenceType: "ci-aggregate",
  generatedAt: new Date().toISOString(),
  commitSha: sha,
  repository,
  event: process.env.GITHUB_EVENT_NAME ?? "unknown",
  run: {
    id,
    attempt,
    url: `https://github.com/${repository}/actions/runs/${id}/attempts/${attempt}`,
  },
  verdict: blockers.length ? "NOT_READY" : "CI_PASSED",
  productionApproved: false,
  gates,
  blockers,
};
writeFileSync(
  process.env.CI_EVIDENCE_PATH ?? "ci-evidence.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(`${evidence.verdict}: ${gates.length} CI job results`);
for (const blocker of blockers) console.error(blocker);
process.exitCode = blockers.length ? 1 : 0;
