import { createServer, type Server } from "node:http";

/**
 * Health signalling for the outbox worker.
 *
 * A worker has no request traffic, so without this an orchestrator has no way to
 * tell "idle" from "wedged" — a deadlocked loop looks exactly like a healthy one
 * with nothing to do. Liveness therefore checks that the loop is still TICKING,
 * not that it is doing work.
 *
 *   /healthz  liveness  — 200 while a sweep has completed recently. Restart on 503.
 *   /readyz   readiness — 200 until shutdown begins, then 503 so the orchestrator
 *                         stops counting this instance before it exits.
 */

export type WorkerHealthState = {
  startedAt: number;
  lastSweepFinishedAt: number | null;
  lastSweepError: string | null;
  consecutiveFailedSweeps: number;
  sweeps: number;
  shuttingDown: boolean;
};

export function createHealthState(): WorkerHealthState {
  return {
    startedAt: Date.now(),
    lastSweepFinishedAt: null,
    lastSweepError: null,
    consecutiveFailedSweeps: 0,
    sweeps: 0,
    shuttingDown: false,
  };
}

export function evaluateLiveness(
  state: WorkerHealthState,
  staleAfterMs: number,
  now: number = Date.now(),
): { healthy: boolean; reason: string } {
  // Before the first sweep completes, grant one stale-window of grace so a slow
  // cold start is not mistaken for a hang.
  const since = state.lastSweepFinishedAt ?? state.startedAt;

  if (now - since > staleAfterMs) {
    return { healthy: false, reason: `no completed sweep in ${now - since}ms` };
  }
  // Repeated total failure means the loop is running but achieving nothing —
  // usually a lost database. Restarting is the correct response.
  if (state.consecutiveFailedSweeps >= 5) {
    return { healthy: false, reason: `${state.consecutiveFailedSweeps} consecutive failed sweeps` };
  }
  return { healthy: true, reason: "ok" };
}

export function startHealthServer(args: {
  state: WorkerHealthState;
  port: number;
  staleAfterMs: number;
}): Server {
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];

    const respond = (status: number, body: Record<string, unknown>) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
        "cache-control": "no-store",
      });
      res.end(payload);
    };

    if (path === "/healthz") {
      const liveness = evaluateLiveness(args.state, args.staleAfterMs);
      respond(liveness.healthy ? 200 : 503, {
        status: liveness.healthy ? "ok" : "unhealthy",
        reason: liveness.reason,
        sweeps: args.state.sweeps,
        lastSweepFinishedAt: args.state.lastSweepFinishedAt,
        // Only the message, never a stack: this endpoint may be reachable
        // from inside the cluster network.
        lastSweepError: args.state.lastSweepError,
      });
      return;
    }

    if (path === "/readyz") {
      const ready = !args.state.shuttingDown;
      respond(ready ? 200 : 503, { status: ready ? "ready" : "draining" });
      return;
    }

    respond(404, { status: "not_found" });
  });

  // Without this, a bind failure raises an unhandled 'error' event and takes the
  // worker down with a bare stack trace. EADDRINUSE almost always means a second
  // worker was started on the same host, which is worth failing on — but it must
  // fail legibly, and any other socket error must not kill a healthy worker.
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        JSON.stringify({
          level: "error",
          message: "worker.health.port_in_use",
          module: "outbox-worker",
          port: args.port,
          hint: "Another worker is already bound to this port. Set OUTBOX_WORKER_HEALTH_PORT.",
        }),
      );
      process.exit(1);
    }
    console.error(
      JSON.stringify({
        level: "error",
        message: "worker.health.server_error",
        module: "outbox-worker",
        error: error.message,
      }),
    );
  });

  server.listen(args.port);
  // The health server must never be the reason the process stays alive.
  server.unref();
  return server;
}
