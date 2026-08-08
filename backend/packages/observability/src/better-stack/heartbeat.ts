import { structuredLogger } from "../logger";

let lastHeartbeatAt = 0;
const MIN_HEARTBEAT_INTERVAL_MS = 30_000;

function readHeartbeatUrl(): string | null {
  const url = process.env["BETTER_STACK_WORKER_HEARTBEAT_URL"]?.trim();
  return url && url.length > 0 ? url : null;
}

export async function pingWorkerHeartbeat(force = false): Promise<void> {
  const heartbeatUrl = readHeartbeatUrl();
  if (!heartbeatUrl) {
    return;
  }

  const now = Date.now();
  if (!force && now - lastHeartbeatAt < MIN_HEARTBEAT_INTERVAL_MS) {
    return;
  }

  lastHeartbeatAt = now;

  try {
    const response = await fetch(heartbeatUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      structuredLogger.warn({
        message: "worker.heartbeat.failed",
        statusCode: response.status,
        module: "better-stack",
      });
    }
  } catch {
    structuredLogger.warn({
      message: "worker.heartbeat.error",
      module: "better-stack",
    });
  }
}
