// Local drill fixture. Imports real health/heartbeat implementations;
// its release endpoint and sweep progress are simulated, never an LMS deployment.
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import {
  createHealthState,
  startHealthServer,
} from "../../backend/apps/api/src/worker/worker-health";
import { pingWorkerHeartbeat } from "../../backend/packages/observability/src/better-stack/heartbeat";

async function main() {
  const state = createHealthState();
  const worker = startHealthServer({ state, port: 0, staleAfterMs: 120_000 });
  await once(worker, "listening");
  let failing = false;
  const api = createServer((_request, response) => {
    const requestId = randomUUID();
    response.writeHead(failing ? 503 : 200, {
      "content-type": "application/json",
      "x-request-id": requestId,
      connection: "close",
    });
    response.end(
      JSON.stringify({
        ok: !failing,
        service: "atlas-lms",
        status: failing ? "unhealthy" : "healthy",
        release: process.env.RELEASE_SHA,
        environment: "local-synthetic-fixture",
        requestId,
      }),
    );
  });
  api.listen(Number(process.env.DRILL_API_PORT ?? 0), "127.0.0.1");
  await once(api, "listening");
  const apiAddress = api.address();
  const workerAddress = worker.address();
  if (
    !apiAddress ||
    typeof apiAddress === "string" ||
    !workerAddress ||
    typeof workerAddress === "string"
  )
    throw new Error("No fixture address");
  process.send?.({ type: "ready", apiPort: apiAddress.port, workerPort: workerAddress.port });
  process.on("message", async (message: { id: number; command: string }) => {
    switch (message.command) {
      case "fail-api":
        failing = true;
        break;
      case "stall-worker":
        state.startedAt = Date.now() - 180_000;
        break;
      case "recover-worker":
        state.lastSweepFinishedAt = Date.now();
        state.sweeps += 1;
        break;
      case "drain":
        state.shuttingDown = true;
        break;
      case "heartbeat":
        await pingWorkerHeartbeat(true);
        break;
      default:
        throw new Error("Unknown fixture command");
    }
    process.send?.({ type: "done", id: message.id });
  });
}
void main();
