// A stand-in server entry for server-cluster.mjs's session-forgetting relay
// (tests/unit/api/server-cluster-forget.test.ts). Each process reports the
// forget messages it receives; the first one sends one valid message and one
// malformed one once every process is up.
import cluster from "node:cluster";
import process from "node:process";
import { setInterval, setTimeout } from "node:timers";

const report = (event, fields = {}) =>
  process.stdout.write(`${JSON.stringify({ event, worker: cluster.worker?.id, ...fields })}\n`);

process.on("message", (message) => {
  if (message && message.type === "atlas.sessions.forget") report("forgot", { keys: message.keys });
});

report("ready");
if (cluster.worker?.id === 1) {
  setTimeout(() => {
    process.send({ type: "atlas.sessions.forget", keys: [], principalIds: [123] });
    process.send({ type: "atlas.sessions.forget", keys: ["k1"], principalIds: ["p1"] });
  }, 1_500);
}
setInterval(() => undefined, 1_000);
