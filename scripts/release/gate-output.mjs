// What a failed release-suite gate keeps of its output (run-suite.mjs).
//
// A gate used to record the first 500 characters of its output. For the
// integration gate that was a Vite configuration warning, and the failing
// test, which the test runner reports at the end, was never seen (CI,
// 15 and 17 November 2026). A failed gate now keeps the end of its output in
// the evidence file and prints a longer end to the CI log.

/** spawnSync's buffer for a gate's output; Node's default of 1 MiB is too small for a test suite. */
export const GATE_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;

const EVIDENCE_STDOUT_CHARS = 3_000;
const EVIDENCE_STDERR_CHARS = 1_000;
const LOG_CHARS = 20_000;

// Colour and cursor codes from the test runner, which only clutter a file.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, "g");

function tail(text, limit) {
  const clean = (text ?? "").replace(ANSI, "").trimEnd();
  if (clean.length <= limit) return clean;
  return `…${clean.slice(clean.length - limit)}`;
}

/** Why the gate's process failed to run or finish, when it did. */
function processError(result) {
  if (!result.error) return null;
  if (result.error.code === "ENOBUFS") {
    return `Output exceeded ${GATE_OUTPUT_MAX_BUFFER / (1024 * 1024)} MiB; the gate was stopped`;
  }
  return result.error.message;
}

/**
 * The evidence file's message for a failed gate: the end of its output, where
 * the failures are reported, rather than the beginning.
 */
export function gateFailureMessage(result) {
  const parts = [];
  const error = processError(result);
  if (error) parts.push(error);
  if (result.signal) parts.push(`Stopped by ${result.signal}`);
  else if (typeof result.status === "number" && result.status !== 0)
    parts.push(`Exit code ${result.status}`);
  const stdout = tail(result.stdout, EVIDENCE_STDOUT_CHARS);
  const stderr = tail(result.stderr, EVIDENCE_STDERR_CHARS);
  if (stdout) parts.push(`stdout (end):\n${stdout}`);
  if (stderr) parts.push(`stderr (end):\n${stderr}`);
  return parts.join("\n") || "failed";
}

/** A longer end of a failed gate's output, for the CI log. */
export function gateFailureLog(id, result) {
  const stdout = tail(result.stdout, LOG_CHARS);
  const stderr = tail(result.stderr, LOG_CHARS);
  return [
    `::group::Release gate ${id} failed`,
    gateFailureMessage({ ...result, stdout: "", stderr: "" }),
    stdout ? `--- stdout (last ${LOG_CHARS} characters) ---\n${stdout}` : "",
    stderr ? `--- stderr (last ${LOG_CHARS} characters) ---\n${stderr}` : "",
    "::endgroup::",
  ]
    .filter(Boolean)
    .join("\n");
}
