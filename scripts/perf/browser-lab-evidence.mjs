import { assertIsolatedFixtureTarget } from "../e2e/isolated-target.mjs";

const metricKeys = ["lcpMs", "inpMs", "cls", "downloadedJsBytes"];
export function normalizeLabSample(sample) {
  const result = { route: sample.route };
  for (const key of metricKeys) {
    result[key] =
      typeof sample[key] === "number" && Number.isFinite(sample[key]) && sample[key] >= 0
        ? sample[key]
        : null;
  }
  result.interactionCount =
    Number.isInteger(sample.interactionCount) && sample.interactionCount > 0
      ? sample.interactionCount
      : 0;
  return result;
}

export function assertLabCoverage(samples, routes) {
  const failures = [];
  for (const route of routes) {
    const matches = samples.filter((sample) => sample.route === route);
    if (matches.length !== 1) {
      failures.push(`${route}: expected exactly one sample`);
      continue;
    }
    const sample = normalizeLabSample(matches[0]);
    for (const key of metricKeys)
      if (sample[key] === null) failures.push(`${route}: missing ${key}`);
    if (!sample.interactionCount) failures.push(`${route}: missing real interaction`);
  }
  if (failures.length)
    throw new Error(`Incomplete synthetic mobile lab evidence: ${failures.join("; ")}`);
}

export function assertLocalLabTarget(baseUrl, authUrl, databaseUrl) {
  const target = new URL(baseUrl);
  if (
    target.protocol !== "http:" ||
    target.port !== "3100" ||
    target.pathname !== "/" ||
    target.search ||
    target.hash ||
    target.username ||
    target.password ||
    !(
      target.hostname === "localhost" ||
      target.hostname === "127.0.0.1" ||
      target.hostname.endsWith(".localhost")
    )
  )
    throw new Error("Mobile lab requires the explicit isolated localhost:3100 fixture stack.");
  assertIsolatedFixtureTarget({ authUrl, databaseUrl });
}
