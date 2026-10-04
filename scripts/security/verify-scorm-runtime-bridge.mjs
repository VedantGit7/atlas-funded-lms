#!/usr/bin/env node
/* global window -- Playwright evaluate callbacks execute inside Chromium. */
// Browser acceptance for SCORM playback (audit H2), using the production pieces:
// the package sandbox headers, runtime injection, the in-package SCORM runtime,
// the Fetch Metadata rule and the player's bridge validation. No LMS, database,
// credentials or external providers: a fixture server stands in for the routes.
import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { chromium, expect } from "@playwright/test";
import { buildDocumentCsp } from "../../configs/security-headers.mjs";
import { scormContentSecurityHeaders } from "../../backend/packages/storage/src/scorm-content-headers.ts";
import {
  buildScormRuntimeScript,
  injectScormRuntimeTag,
  SCORM_RUNTIME_FILE,
} from "../../backend/apps/api/src/server/courses/scorm-runtime.ts";
import { isSameOriginSubresourceRequest } from "../../backend/apps/api/src/server/courses/scorm-fetch-metadata.ts";

const nonce = "abcdefghijklmnopqrstuvwx";
const launchId = "launch_fixture_0123456789";
const root = `/scorm/capability-fixture`;
const bridgeModule = stripTypeScriptTypes(
  readFileSync(
    new URL("../../frontend/apps/web/src/features/courses/scorm-bridge.ts", import.meta.url),
    "utf8",
  ),
);
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

// A representative package: nested launch path, relative script/style/image,
// a nested SCO frame, and a file an attacker would like the app page to run.
const packageFiles = {
  "course/index.html": [
    "text/html",
    `<!doctype html><html><head><meta charset="utf-8"><title>Fixture SCO</title>
      <link rel="stylesheet" href="css/style.css"><script src="js/sco.js"></script></head>
      <body><img src="media/pixel.png" alt=""><iframe title="nested" src="pages/nested.html"></iframe></body></html>`,
  ],
  "course/css/style.css": ["text/css", "body { margin: 0 }"],
  "course/media/pixel.png": ["image/png", pixel],
  "course/js/sco.js": [
    "application/javascript",
    `function findAPI(win, name) {
       for (var depth = 0; win && depth < 10; depth += 1) {
         try { if (win[name]) return win[name]; } catch (denied) {}
         if (win.parent === win) break;
         win = win.parent;
       }
       return null;
     }
     var api = findAPI(window, "API_1484_11");
     var result = { found: !!api };
     result.initialized = api.Initialize("");
     result.resumedLocation = api.GetValue("cmi.location");
     result.learnerName = api.GetValue("cmi.learner_name");
     result.entry = api.GetValue("cmi.entry");
     result.readOnlyRejected = api.SetValue("cmi.learner_id", "x") === "false" && api.GetLastError() === "404";
     api.SetValue("cmi.location", "slide-2");
     api.SetValue("cmi.completion_status", "completed");
     api.SetValue("cmi.session_time", "PT3M");
     result.committed = api.Commit("");
     try { parent.document.title; result.parentDomDenied = false; } catch (e) { result.parentDomDenied = true; }
     try { document.cookie; result.cookiesDenied = false; } catch (e) { result.cookiesDenied = true; }
     try { localStorage.getItem("x"); result.storageDenied = false; } catch (e) { result.storageDenied = true; }
     result.terminated = api.Terminate("");
     window.top.postMessage({ protocol: "fixture-result", frame: "sco", result: result }, location.origin);
     // A multi-page SCO: the frame moves on to its next document.
     setTimeout(function () { location.href = "pages/page2.html"; }, 300);`,
  ],
  "course/pages/page2.html": [
    "text/html",
    `<!doctype html><html><head><title>Page 2</title></head><body><script>
       var own = window.API_1484_11;
       var result = { ownApi: !!own, seededLocation: "" };
       own.Initialize("");
       result.seededLocation = own.GetValue("cmi.location");
       // The player answers this document's hello with the newest saved data.
       setTimeout(function () {
         result.refreshedLocation = own.GetValue("cmi.location");
         own.SetValue("cmi.suspend_data", "from-page-2");
         result.committed = own.Commit("");
         window.top.postMessage({ protocol: "fixture-result", frame: "page2", result: result }, location.origin);
       }, 500);
     </script></body></html>`,
  ],
  "course/pages/nested.html": [
    "text/html",
    `<!doctype html><html><body><script>
       window.top.postMessage({ protocol: "fixture-result", frame: "nested", result: {} }, location.origin);
     </script></body></html>`,
  ],
  "course/js/evil.js": ["application/javascript", "window.evilRan = true;"],
};

const requests = [];
let browser;
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://fixture.invalid");
  const headers = { get: (name) => request.headers[name] ?? null };
  const authenticated = request.headers.cookie === "scorm_fixture=learner";
  requests.push({
    path: url.pathname,
    authenticated,
    site: request.headers["sec-fetch-site"] ?? null,
    dest: request.headers["sec-fetch-dest"] ?? null,
  });
  if (url.pathname === "/") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "set-cookie": "scorm_fixture=learner; SameSite=Lax; HttpOnly; Path=/",
      "content-security-policy": buildDocumentCsp(nonce, {
        NODE_ENV: "production",
        CSP_ENFORCE: "1",
      }),
      "x-frame-options": "DENY",
    });
    response.end(`<!doctype html><html><head><title>Player fixture</title></head><body>

      <script type="module" nonce="${nonce}">
        import { isFromPackageFrame, parseScormBridgeMessage } from "/bridge.js";
        window.accepted = [];
        window.rejected = 0;
        window.fixtureResults = {};
        addEventListener("message", (event) => {
          if (event.data && event.data.protocol === "fixture-result") {
            window.fixtureResults[event.data.frame] = { origin: event.origin, ...event.data.result };
            return;
          }
          const frame = document.getElementById("package").contentWindow;
          const message = isFromPackageFrame(event.source, frame)
            ? parseScormBridgeMessage(event.data, "${launchId}")
            : null;
          if (!message) {
            window.rejected += 1;
            return;
          }
          window.accepted.push({ origin: event.origin, ...message });
          if (message.values) window.latest = { ...(window.latest ?? {}), ...message.values };
          if (message.type === "hello" && window.latest) {
            event.source.postMessage(
              { protocol: "atlas-scorm-player", version: 1, launchId: "${launchId}", type: "state", values: window.latest },
              "*",
            );
          }
        });
        // Frames are added only once the listener is attached, as the real player does:
        // a package (or an impostor) may post the moment it loads.
        const frame = (attributes) => {
          const element = document.createElement("iframe");
          for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
          document.body.append(element);
        };
        frame({ id: "package", title: "SCORM package", sandbox: "allow-scripts allow-forms allow-popups",
          referrerpolicy: "no-referrer", src: "${root}/course/index.html" });
        frame({ id: "impostor", title: "Impostor", sandbox: "allow-scripts", src: "/impostor.html" });
        // The H5 attack: an app page (e.g. a tenant snippet) loading package JS as its own script.
        const evil = document.createElement("script");
        evil.nonce = "${nonce}";
        evil.src = "${root}/course/js/evil.js";
        evil.onerror = () => { window.evilBlocked = true; };
        document.body.append(evil);
      </script>
    </body></html>`);
    return;
  }
  if (url.pathname === "/impostor.html") {
    // Knows the launch id and protocol, but is not inside the package iframe.
    response.writeHead(200, { "content-type": "text/html", ...scormContentSecurityHeaders() });
    response.end(`<script>parent.postMessage({ protocol: "atlas-scorm", version: 1, launchId: "${launchId}",
      type: "commit", values: { "cmi.completion_status": "completed", "cmi.location": "impostor" } }, "*");</script>`);
    return;
  }
  if (url.pathname === "/bridge.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    response.end(bridgeModule);
    return;
  }
  if (url.pathname.startsWith(`${root}/`)) {
    // Same order as the real route: Fetch Metadata first, then the file.
    if (isSameOriginSubresourceRequest(headers)) {
      response.writeHead(404, { "content-type": "application/json" }).end("{}");
      return;
    }
    const path = decodeURIComponent(url.pathname.slice(root.length + 1));
    if (path === SCORM_RUNTIME_FILE) {
      response.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "private, no-store",
        ...scormContentSecurityHeaders(),
      });
      response.end(
        buildScormRuntimeScript({
          launchId,
          version: "2004",
          values: { "cmi.location": "slide-1" },
          learnerId: "membership-fixture",
          learnerName: "Fixture Learner",
          entry: "resume",
          totalSeconds: 60,
        }),
      );
      return;
    }
    const file = packageFiles[path];
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    const [contentType, body] = file;
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
    response.writeHead(200, { "content-type": contentType, ...scormContentSecurityHeaders() });
    response.end(
      contentType === "text/html"
        ? injectScormRuntimeTag(bytes, `${root}/${SCORM_RUNTIME_FILE}`)
        : bytes,
    );
    return;
  }
  response.writeHead(204).end();
});

try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const channel = existsSync(chromium.executablePath()) ? undefined : "chrome";
  browser = await chromium.launch({
    ...(channel ? { channel } : {}),
    headless: true,
    timeout: 20_000,
    args: ["--disable-background-networking", "--disable-component-update", "--no-first-run"],
  });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const external = [];
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin !== origin) {
      external.push(route.request().resourceType());
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  const framingRefusals = [];
  page.on("console", (message) => {
    if (/frame-ancestors|X-Frame-Options/i.test(message.text()))
      framingRefusals.push(message.text());
  });
  page.setDefaultTimeout(10_000);
  await page.goto(origin);

  await expect
    .poll(() => page.evaluate(() => Object.keys(window.fixtureResults ?? {}).sort()))
    .toEqual(["page2", "sco"]);
  await expect.poll(() => page.evaluate(() => window.evilBlocked === true)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.rejected)).toBeGreaterThanOrEqual(1);
  const state = await page.evaluate(() => ({
    accepted: window.accepted,
    rejected: window.rejected,
    results: window.fixtureResults,
    evilRan: window.evilRan === true,
  }));

  // The package found a synchronous API, resumed, and was refused read-only writes.
  assert.deepEqual(state.results.sco, {
    origin: "null",
    found: true,
    initialized: "true",
    resumedLocation: "slide-1",
    learnerName: "Fixture Learner",
    entry: "resume",
    readOnlyRejected: true,
    committed: "true",
    parentDomDenied: true,
    cookiesDenied: true,
    storageDenied: true,
    terminated: "true",
  });
  // The next page of a multi-page SCO gets its own API, seeded when served, then
  // refreshed by the player with what the previous page committed.
  assert.deepEqual(state.results.page2, {
    origin: "null",
    ownApi: true,
    seededLocation: "slide-1",
    refreshedLocation: "slide-2",
    committed: "true",
  });
  // Documented limitation (CSP runbook): an iframe *inside* a package has an
  // opaque parent, which no frame-ancestors source can match, so nested SCO
  // frames stay blocked rather than relaxing the framing policy.
  assert.equal(state.results.nested, undefined);
  assert(
    framingRefusals.some((text) => text.includes("frame-ancestors")),
    "the nested package frame is refused by frame-ancestors",
  );

  // The bridge accepted the package's protocol from inside its iframe only.
  assert(state.accepted.every((message) => message.origin === "null"));
  const commits = state.accepted.filter((message) => message.type === "commit");
  assert(
    commits.some(
      (message) =>
        message.values["cmi.location"] === "slide-2" &&
        message.values["cmi.completion_status"] === "completed" &&
        message.values["cmi.session_time"] === "PT3M",
    ),
  );
  assert(commits.some((message) => message.values["cmi.suspend_data"] === "from-page-2"));
  assert(state.accepted.some((message) => message.type === "terminate"));
  assert(state.rejected >= 1, "the impostor frame's well-formed message must be rejected");
  assert(!state.accepted.some((message) => message.values?.["cmi.location"] === "impostor"));

  // Package files load by relative URL beneath the capability, with no cookie,
  // as cross-site requests; only the player's iframe navigation is same-origin.
  const packageRequests = requests.filter((entry) => entry.path.startsWith(`${root}/`));
  const launch = packageRequests.find((entry) => entry.path === `${root}/course/index.html`);
  assert.deepEqual(
    { site: launch?.site, dest: launch?.dest },
    { site: "same-origin", dest: "iframe" },
  );
  for (const asset of [
    "css/style.css",
    "media/pixel.png",
    "js/sco.js",
    "pages/page2.html",
    SCORM_RUNTIME_FILE,
  ]) {
    const entry = packageRequests.find(
      (candidate) =>
        candidate.path === `${root}/course/${asset}` || candidate.path === `${root}/${asset}`,
    );
    assert(entry, `${asset} was requested`);
    assert.equal(entry.site, "cross-site", `${asset} is cross-site`);
    assert.equal(entry.authenticated, false, `${asset} carries no session cookie`);
  }

  // The H5 bypass: the app page's own CSP allows same-origin script, so the
  // server-side Fetch Metadata rule is what refuses it.
  const evil = packageRequests.find((entry) => entry.path === `${root}/course/js/evil.js`);
  assert.deepEqual({ site: evil?.site, dest: evil?.dest }, { site: "same-origin", dest: "script" });
  assert.equal(state.evilRan, false);
  assert.deepEqual(external, []);

  console.log(
    JSON.stringify(
      {
        acceptance: "passed",
        browser: browser.version(),
        checks: [
          "package documents run opaque: no parent DOM, cookies or storage",
          "relative scripts, styles, images and next pages load beneath the capability without cookies",
          "each package document gets a synchronous SCORM 2004 API seeded with resume data",
          "a multi-page SCO's next document is refreshed with the previous page's commits",
          "nested SCO frames stay blocked by frame-ancestors (documented limitation)",
          "commits and terminate reach the player only from inside its iframe, with origin null",
          "a well-formed message from a frame outside the package iframe is rejected",
          "an app page cannot load package JavaScript as its own script (H5 bypass)",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
