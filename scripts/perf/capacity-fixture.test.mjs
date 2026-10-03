import test from "node:test";
import assert from "node:assert/strict";
import { assertCapacityTarget, makeCapacityConfig } from "./capacity-fixture.mjs";

const target = {
  databaseUrl: "postgres://atlas@127.0.0.1:15436/atlas_lms_e2e",
  authUrl: "http://127.0.0.1:54326",
  acknowledged: true,
};
test("capacity seeding accepts only the explicitly acknowledged isolated target", () => {
  assert.doesNotThrow(() => assertCapacityTarget(target));
  for (const change of [
    { acknowledged: false },
    { databaseUrl: target.databaseUrl.replace("15436", "5432") },
    { databaseUrl: target.databaseUrl.replace("atlas_lms_e2e", "production") },
    { authUrl: "https://example.com" },
    { authUrl: "http://127.0.0.1:54327" },
    { databaseUrl: `${target.databaseUrl}?host=remote` },
  ])
    assert.throws(() => assertCapacityTarget({ ...target, ...change }));
});
test("capacity configuration creates 200 distinct disposable identities and a private proxy token", () => {
  const c = makeCapacityConfig({ courseId: "course", lessonId: "lesson" });
  assert.equal(c.users.length, 200);
  assert.equal(new Set(c.users.map((u) => u.email)).size, 200);
  assert.equal(new Set(c.users.map((u) => u.password)).size, 200);
  assert.match(c.fixtureProxyToken, /^[a-f0-9]{64}$/);
  assert.ok(
    c.users.every(
      (u, i) =>
        u.actorIndex === i && /^perf20260926-\d{3}\+fundedbeyond@atlas-e2e\.test$/.test(u.email),
    ),
  );
  assert.equal(c.phases.at(-1).seconds, 7200);
  assert.equal(c.phases.find((p) => p.name === "sustained").users, 100);
  assert.equal(c.phases.find((p) => p.name === "burst").users, 200);
});
