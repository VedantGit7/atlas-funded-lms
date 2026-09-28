import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Readable, Writable } from "node:stream";
import { validateEdgeRequest, forwardHeaders, createEdgeServer } from "./local-edge.mjs";

const token = "a".repeat(64);
const headers = {
  host: "fundedbeyond.localhost:3100",
  "x-atlas-perf-token": token,
  "x-atlas-perf-actor": "199",
};
test("edge rejects wrong credentials, hosts, actor indices and absolute request targets", () => {
  assert.equal(validateEdgeRequest({ headers, url: "/api/session" }, token), 199);
  for (const changes of [
    { host: "evil.localhost:3100" },
    { "x-atlas-perf-token": "bad" },
    { "x-atlas-perf-actor": "200" },
    { "x-atlas-perf-actor": "-1" },
    { "x-atlas-perf-actor": "01" },
  ])
    assert.throws(() =>
      validateEdgeRequest({ headers: { ...headers, ...changes }, url: "/" }, token),
    );
  for (const url of ["http://example.com/", "//example.com/", "/\\evil"])
    assert.throws(() => validateEdgeRequest({ headers, url }, token));
});
test("edge replaces all proxy identity inputs and removes fixture and hop headers", () => {
  const result = forwardHeaders(
    {
      ...headers,
      cookie: "fixture",
      "x-forwarded-for": "1.2.3.4",
      forwarded: "for=evil",
      "x-real-ip": "bad",
      "cf-connecting-ip": "bad",
      "x-atlas-client-ip": "bad",
      "x-atlas-proxy-key": "bad",
      connection: "x-secret",
      "x-secret": "bad",
    },
    199,
  );
  assert.equal(result["x-forwarded-for"], "198.18.0.200");
  assert.equal(result["x-forwarded-proto"], "http");
  assert.equal(result.host, headers.host);
  assert.equal(result.cookie, "fixture");
  for (const name of [
    "x-atlas-perf-token",
    "x-atlas-perf-actor",
    "x-atlas-client-ip",
    "x-atlas-proxy-key",
    "forwarded",
    "x-real-ip",
    "cf-connecting-ip",
    "connection",
    "x-secret",
  ])
    assert.equal(result[name], undefined);
});
test("local HTTP server denies unauthenticated requests without contacting upstream", async () => {
  let contacted = false;
  const server = createEdgeServer(token, () => {
    contacted = true;
    throw new Error("unexpected upstream");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await new Promise((resolve, reject) => {
      http
        .get(
          {
            hostname: "127.0.0.1",
            port: server.address().port,
            path: "/",
            headers: { host: headers.host },
          },
          resolve,
        )
        .on("error", reject);
    });
    response.resume();
    assert.equal(response.statusCode, 403);
    assert.equal(contacted, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("authenticated proxy fixes its upstream, preserves cookies and strips fixture headers", async () => {
  let captured,
    body = "";
  const server = createEdgeServer(token, (options, reply) => {
    captured = options;
    return new Writable({
      write(chunk, encoding, done) {
        body += chunk.toString();
        done();
      },
      final(done) {
        const incoming = Readable.from([Buffer.from('{"ok":true}')]);
        incoming.statusCode = 200;
        incoming.headers = {
          "content-type": "application/json",
          "set-cookie": ["session=local; HttpOnly"],
        };
        reply(incoming);
        done();
      },
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: server.address().port,
          path: "/api/login?next=%2Flearn",
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
        },
        resolve,
      );
      req.on("error", reject);
      req.end('{"fixture":true}');
    });
    const chunks = [];
    for await (const chunk of response) chunks.push(chunk);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.headers["set-cookie"], ["session=local; HttpOnly"]);
    assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { ok: true });
    assert.equal(captured.hostname, "127.0.0.1");
    assert.equal(captured.port, 3102);
    assert.equal(captured.headers["x-atlas-perf-token"], undefined);
    assert.equal(captured.headers["x-forwarded-for"], "198.18.0.200");
    assert.equal(body, '{"fixture":true}');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("proxy refuses upstream redirects outside the fixture origin", async () => {
  const server = createEdgeServer(
    token,
    (options, reply) =>
      new Writable({
        write(chunk, encoding, done) {
          done();
        },
        final(done) {
          const incoming = Readable.from([]);
          incoming.statusCode = 302;
          incoming.headers = { location: "https://external.example/" };
          reply(incoming);
          done();
        },
      }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await new Promise((resolve, reject) =>
      http
        .get({ hostname: "127.0.0.1", port: server.address().port, path: "/", headers }, resolve)
        .on("error", reject),
    );
    response.resume();
    assert.equal(response.statusCode, 502);
    assert.equal(response.headers.location, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
