import { runOutboxSweep, type SweepResult } from "./outbox-sweep";
import { createHealthState, startHealthServer } from "./worker-health";

/**
 * Outbox worker entrypoint.
 *
 * Audit finding C6: the platform wrote events to the outbox and never drained
 * them. Ten `process*OutboxBatch` functions existed and were exported; none was
 * reachable from any deployed code path. This is the long-lived process that
 * calls them.
 *
 * Run with:  pnpm worker:outbox
 */

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer (got "${raw}").`);
  }
  return parsed;
}

function log(level: "info" | "error", message: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    level,
    message,
    module: "outbox-worker",
    timestamp: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.info(line);
}

/**
 * Some client libraries (Prisma among them) throw errors whose `message` is
 * empty and whose detail lives in the name or a `code` property. Logging just
 * `error.message` produced `"error": ""` — a useless alert.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error).slice(0, 500);

  const code = (error as { code?: unknown }).code;
  const parts = [error.name, typeof code === "string" ? `(${code})` : "", error.message].filter(
    (part) => part !== "",
  );
  return parts.join(" ").slice(0, 500);
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function main(): Promise<number> {
  const idleIntervalMs = readInt("OUTBOX_WORKER_INTERVAL_MS", 5_000);
  const batchLimit = readInt("OUTBOX_WORKER_BATCH_LIMIT", 25);
  const maxRetries = readInt("OUTBOX_WORKER_MAX_RETRIES", 3);
  const healthPort = readInt("OUTBOX_WORKER_HEALTH_PORT", 8081);
  const shutdownTimeoutMs = readInt("OUTBOX_WORKER_SHUTDOWN_TIMEOUT_MS", 30_000);

  const state = createHealthState();
  // A sweep that takes longer than several idle intervals is wedged, not busy.
  const staleAfterMs = Math.max(idleIntervalMs * 6, 120_000);
  const healthServer = startHealthServer({ state, port: healthPort, staleAfterMs });

  const shutdown = new AbortController();
  let forced = false;
  // Guarantees the process exits even if a sweep refuses to finish; without it a
  // hung database call would hold the pod through its whole termination grace
  // period and then get SIGKILLed mid-transaction.
  let shutdownDeadline: NodeJS.Timeout | undefined;

  const onSignal = (signal: string) => {
    if (forced) {
      log("error", "worker.shutdown.forced", { signal });
      process.exit(1);
    }
    if (state.shuttingDown) {
      // Second signal: the operator is telling us not to wait.
      forced = true;
      log("error", "worker.shutdown.forced", { signal });
      process.exit(1);
    }
    state.shuttingDown = true;
    shutdown.abort();

    shutdownDeadline = setTimeout(() => {
      log("error", "worker.shutdown.timeout", { shutdownTimeoutMs });
      process.exit(1);
    }, shutdownTimeoutMs);
    shutdownDeadline.unref();

    log("info", "worker.shutdown.requested", { signal, shutdownTimeoutMs });
  };

  process.on("SIGTERM", () => {
    onSignal("SIGTERM");
  });
  process.on("SIGINT", () => {
    onSignal("SIGINT");
  });

  log("info", "worker.started", { idleIntervalMs, batchLimit, maxRetries, healthPort });

  // `for (;;)` with a single exit check at the bottom, rather than a `while`
  // condition: the flag is flipped from a signal handler, so a loop condition
  // reading it would narrow it to `false` for the rest of the body.
  for (;;) {
    let sweep: SweepResult | null = null;

    try {
      sweep = await runOutboxSweep({
        batchLimit,
        maxRetries,
        signal: shutdown.signal,
      });

      state.consecutiveFailedSweeps = 0;
      state.lastSweepError = null;

      if (sweep.processed > 0 || sweep.errors.length > 0) {
        log("info", "worker.sweep.completed", {
          requestId: sweep.requestId,
          tenants: sweep.tenants,
          processed: sweep.processed,
          delivered: sweep.delivered,
          failed: sweep.failed,
          skipped: sweep.skipped,
          errors: sweep.errors.length,
          durationMs: sweep.durationMs,
        });
      }

      for (const error of sweep.errors) {
        log("error", "worker.sweep.processor_failed", {
          requestId: sweep.requestId,
          processor: error.processor,
          tenantId: error.tenantId,
          error: error.message,
        });
      }
    } catch (error) {
      // Only reached when the sweep itself fails (e.g. the tenant listing
      // query) — per-processor failures are captured inside the sweep.
      state.consecutiveFailedSweeps += 1;
      state.lastSweepError = describeError(error);
      log("error", "worker.sweep.failed", {
        error: state.lastSweepError,
        consecutiveFailedSweeps: state.consecutiveFailedSweeps,
      });
    }

    state.sweeps += 1;
    state.lastSweepFinishedAt = Date.now();

    if (state.shuttingDown) break;

    // Drain a backlog at full speed; only idle when there was nothing to do.
    const busy = sweep !== null && sweep.saturated && sweep.errors.length === 0;
    if (!busy) {
      // Back off on repeated failure so a dead database is not hammered.
      const backoff = Math.min(state.consecutiveFailedSweeps, 5) * idleIntervalMs;
      await sleep(idleIntervalMs + backoff, shutdown.signal);
    }
  }

  clearTimeout(shutdownDeadline);
  healthServer.close();
  log("info", "worker.stopped", { sweeps: state.sweeps });
  return 0;
}

/**
 * Bootstrap. Kept exported rather than run on import so tests can load this
 * module without starting the loop; `worker/index.ts` is the actual entrypoint.
 */
export function bootstrap(): void {
  main()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      log("error", "worker.crashed", {
        error: error instanceof Error ? error.stack : String(error),
      });
      process.exit(1);
    });
}
