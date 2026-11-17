import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

/**
 * Staging, 17 November 2026: a signed-out session went on working in the API
 * processes that still had it cached. Ending a session now sends a message
 * that the cluster supervisor passes to every other process, so all of them
 * forget it at once (backend/packages/auth/src/better-auth-runtime.ts).
 */
describe("server-cluster.mjs: forgetting ended sessions in every process", () => {
  it("passes a valid message to every other process, and drops a malformed one", async () => {
    const child = spawn(
      process.execPath,
      [
        "deploy/managed-node/server-cluster.mjs",
        "api",
        "tests/fixtures/cluster-forget-sessions-entry.mjs",
      ],
      {
        cwd: root,
        env: { ...process.env, API_PROCESS_COUNT: "3", API_PROCESS_HEAP_MB: "128" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const events: Array<{ event: string; worker?: number; keys?: string[] }> = [];
    let buffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        try {
          events.push(JSON.parse(line) as (typeof events)[number]);
        } catch {
          // The supervisor's own log lines are JSON too; anything else is noise.
        }
      }
    });

    try {
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        if (events.filter((event) => event.event === "forgot").length >= 2) break;
        await new Promise((done) => setTimeout(done, 100));
      }
      // Time for a wrongly relayed malformed message to arrive too.
      await new Promise((done) => setTimeout(done, 500));
    } finally {
      child.kill("SIGTERM");
    }

    const forgot = events.filter((event) => event.event === "forgot");
    expect(forgot.map((event) => event.worker).sort()).toEqual([2, 3]);
    expect(forgot.every((event) => event.keys?.[0] === "k1")).toBe(true);
  }, 30_000);
});
