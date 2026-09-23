import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function shape(value, fields, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    fields.some((field) => !Object.hasOwn(value, field))
  ) {
    throw new Error(`${label} must explicitly contain exactly: ${fields.join(", ")}`);
  }
}

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${label} must be a safe integer >= ${minimum}`);
  return value;
}

/** Worst-case open connections, including lazy pools and all concurrent instances. */
export function validateConnectionBudget(config) {
  shape(config, ["databaseMaxConnections", "reservedConnections", "processes"], "budget");
  const databaseMaxConnections = integer(
    config.databaseMaxConnections,
    "databaseMaxConnections",
    1,
  );
  const reservedConnections = integer(config.reservedConnections, "reservedConnections");
  shape(config.processes, ["web", "api", "worker"], "processes");
  const processes = {};
  let applicationConnections = 0;
  for (const role of ["web", "api", "worker"]) {
    const process = config.processes[role];
    shape(process, ["instances", "tenantPoolMax", "platformPoolMax", "usagePoolMax"], role);
    const instances = integer(process.instances, `${role}.instances`);
    const tenant = integer(process.tenantPoolMax, `${role}.tenantPoolMax`, instances > 0 ? 1 : 0);
    const platform = integer(
      process.platformPoolMax,
      `${role}.platformPoolMax`,
      instances > 0 ? 1 : 0,
    );
    const usage = integer(process.usagePoolMax, `${role}.usagePoolMax`, instances > 0 ? 1 : 0);
    const pools = integer(tenant + platform + usage, `${role} combined pools`);
    processes[role] = integer(instances * pools, `${role} connections`);
    applicationConnections = integer(
      applicationConnections + processes[role],
      "applicationConnections",
    );
  }
  const totalConnections = integer(
    applicationConnections + reservedConnections,
    "totalConnections",
  );
  if (totalConnections > databaseMaxConnections)
    throw new Error(
      `Connection budget ${totalConnections} exceeds database limit ${databaseMaxConnections}`,
    );
  return {
    databaseMaxConnections,
    reservedConnections,
    applicationConnections,
    totalConnections,
    headroom: databaseMaxConnections - totalConnections,
    processes,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Usage: node scripts/perf/connection-budget.mjs <budget.json>");
    // Do not echo parser errors: an accidentally supplied env file may contain credentials.
    let config;
    try {
      config = JSON.parse(readFileSync(process.argv[2], "utf8"));
    } catch {
      throw new Error("Cannot read a valid JSON budget file");
    }
    console.log(JSON.stringify(validateConnectionBudget(config), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
