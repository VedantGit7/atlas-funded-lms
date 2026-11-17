import { describe, expect, it } from "vitest";
import {
  GATE_OUTPUT_MAX_BUFFER,
  gateFailureLog,
  gateFailureMessage,
} from "../../../scripts/release/gate-output.mjs";

/**
 * CI, 15 and 17 November 2026: the release suite's integration gate failed
 * twice, and its evidence showed only the first 500 characters of output, a
 * Vite warning. The failing test, reported at the end, was never seen.
 */
const warning =
  "\u001b[33m(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`\u001b[39m\n";
const filler = "✓ a passing test\n".repeat(2_000);
const failure =
  " FAIL  tests/integration/api/example.test.ts > a flaky case\nAssertionError: expected 1 to be 2\n Test Files  1 failed | 99 passed (100)\n";

describe("a failed release gate's output", () => {
  const result = { status: 1, signal: null, stdout: `${filler}${failure}`, stderr: warning };

  it("keeps the end of stdout, where the failing test is reported", () => {
    const message = gateFailureMessage(result);
    expect(message).toContain("Exit code 1");
    expect(message).toContain("FAIL  tests/integration/api/example.test.ts > a flaky case");
    expect(message).toContain("AssertionError: expected 1 to be 2");
    expect(message.length).toBeLessThan(4_500);
  });

  it("strips colour codes", () => {
    expect(gateFailureMessage(result)).not.toContain("\u001b[");
  });

  it("prints a longer end, grouped, for the CI log", () => {
    const log = gateFailureLog("integration_tests", result);
    expect(log.startsWith("::group::Release gate integration_tests failed")).toBe(true);
    expect(log.trimEnd().endsWith("::endgroup::")).toBe(true);
    expect(log).toContain("Test Files  1 failed | 99 passed (100)");
    expect(log.length).toBeLessThan(42_000);
  });

  it("says when the output was too large to buffer", () => {
    const enobufs = Object.assign(new Error("spawnSync pnpm ENOBUFS"), { code: "ENOBUFS" });
    const message = gateFailureMessage({
      status: null,
      signal: "SIGTERM",
      stdout: "",
      stderr: "",
      error: enobufs,
    });
    expect(message).toContain(`Output exceeded ${GATE_OUTPUT_MAX_BUFFER / (1024 * 1024)} MiB`);
    expect(message).toContain("Stopped by SIGTERM");
  });

  it("allows a test suite's worth of output", () => {
    expect(GATE_OUTPUT_MAX_BUFFER).toBeGreaterThanOrEqual(64 * 1024 * 1024);
  });
});
