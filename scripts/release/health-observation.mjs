import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Never run URLs through a shell or echo provider response/error text here.
export function observeHealth(baseUrl, expectedRelease) {
  const timeoutMs = Number(process.env.RELEASE_HEALTH_TIMEOUT_MS ?? 10_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    return { ok: false, failure: "Invalid health timeout; expected 100..30000 milliseconds" };
  }
  let origin;
  try {
    const url = new URL(baseUrl);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      !["https:", "http:"].includes(url.protocol) ||
      (url.protocol === "http:" && !loopback)
    )
      throw new Error("Invalid URL");
    origin = url.origin;
  } catch {
    return { ok: false, failure: "Invalid health base URL" };
  }
  const child = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../observability/release-health.mjs", import.meta.url))],
    {
      shell: false,
      encoding: "utf8",
      timeout: timeoutMs * 2 + 2000,
      maxBuffer: 128 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
        RELEASE_HEALTH_BASE_URL: origin,
        RELEASE_HEALTH_EXPECTED_RELEASE: expectedRelease,
      },
    },
  );
  let valid = false;
  try {
    valid = JSON.parse(child.stdout).ok === true;
  } catch {
    /* fail closed */
  }
  const ok = child.status === 0 && !child.error && valid;
  return { ok, origin, ...(ok ? {} : { failure: "Release health observation failed" }) };
}
