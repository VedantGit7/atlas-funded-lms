#!/usr/bin/env node
/* global window -- Playwright evaluate callbacks execute inside Chromium. */
// Diagnostic of an OPEN compatibility blocker; passing is not SCORM acceptance.
// Uses fixture cookies only. No LMS, database, credentials or external providers.
import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { chromium, expect } from "@playwright/test";
import { buildDocumentCsp } from "../../configs/security-headers.mjs";
import { scormContentSecurityHeaders } from "../../backend/packages/storage/src/scorm-content-headers.ts";

const nonce = "abcdefghijklmnopqrstuvwx";
const requests = [];
const externalRequests = [];
let browser;
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://fixture.invalid").pathname;
  const authenticated = request.headers.cookie === "scorm_fixture=learner";
  requests.push({ path, authenticated, site: request.headers["sec-fetch-site"] });
  if (path === "/") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "set-cookie": "scorm_fixture=learner; SameSite=Lax; HttpOnly; Path=/",
      "content-security-policy": buildDocumentCsp(nonce, {
        NODE_ENV: "production",
        CSP_ENFORCE: "1",
      }),
      "x-frame-options": "DENY",
    });
    response.end(`<!doctype html><html><head><title>SCORM boundary fixture</title></head><body>
      <script nonce="${nonce}">
        window.boundary = null;
        addEventListener('message', (event) => {
          if (event.source === document.querySelector('iframe').contentWindow && event.origin === 'null') {
            window.boundary = event.data;
          }
        });
      </script>
      <iframe title="Opaque SCORM fixture" src="/content/launch.html"></iframe>
    </body></html>`);
    return;
  }
  if (path === "/content/launch.html") {
    response.writeHead(authenticated ? 200 : 401, {
      "content-type": "text/html; charset=utf-8",
      ...scormContentSecurityHeaders(),
    });
    response.end(`<!doctype html><html><body>
      <script>
        const result = { parentDomDenied: false, cookiesDenied: false, storageDenied: false };
        try { parent.document.title; } catch { result.parentDomDenied = true; }
        try { document.cookie; } catch { result.cookiesDenied = true; }
        try { localStorage.getItem('fixture'); } catch { result.storageDenied = true; }
        parent.postMessage(result, location.origin);
      </script>
      <script src="asset.js"></script>
    </body></html>`);
    return;
  }
  if (path === "/content/asset.js") {
    response.writeHead(authenticated ? 200 : 401, {
      "content-type": "application/javascript",
      ...scormContentSecurityHeaders(),
    });
    response.end(authenticated ? "window.packageAssetLoaded = true;" : "");
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
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin !== origin) {
      externalRequests.push(route.request().resourceType());
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);
  page.setDefaultNavigationTimeout(8_000);
  const assetResponse = page.waitForResponse(`${origin}/content/asset.js`);
  await page.goto(origin);
  assert.equal((await assetResponse).status(), 401);
  await expect
    .poll(() => page.evaluate(() => window.boundary))
    .toEqual({
      parentDomDenied: true,
      cookiesDenied: true,
      storageDenied: true,
    });
  assert.equal(
    requests.find((entry) => entry.path === "/content/launch.html")?.authenticated,
    true,
  );
  assert.deepEqual(
    requests.find((entry) => entry.path === "/content/asset.js"),
    {
      path: "/content/asset.js",
      authenticated: false,
      site: "cross-site",
    },
  );
  assert.deepEqual(externalRequests, []);
  console.log(
    JSON.stringify(
      {
        diagnostic: "verified",
        applicationAcceptance: "blocked",
        browser: browser.version(),
        checks: [
          "iframe navigation receives the fixture SameSite=Lax session cookie",
          "opaque package relative asset request omits the session cookie and receives 401",
          "package cannot read parent DOM, cookies or localStorage",
          "no external page requests",
        ],
        remaining:
          "Design scoped package-read authorization before implementing asset routing and the SCORM bridge.",
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
