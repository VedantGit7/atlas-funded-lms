#!/usr/bin/env node
/* global window -- Playwright evaluate callbacks execute inside Chromium. */
// Isolated policy proof only: no LMS server, database, credentials or providers.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { chromium, expect } from "@playwright/test";
import { buildDocumentCsp, CSP_REPORT_PATH } from "../../configs/security-headers.mjs";

const environment = { NODE_ENV: "production", APP_ENV: "production", CSP_ENFORCE: "1" };
const reports = [];
const externalRequests = [];
const checks = [];
let browser;

function document(response, contents, { sameOriginFrame = false } = {}) {
  const nonce = randomBytes(24).toString("base64");
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": buildDocumentCsp(nonce, environment, { sameOriginFrame }),
    "x-frame-options": sameOriginFrame ? "SAMEORIGIN" : "DENY",
    "cache-control": "no-store",
  });
  response.end(
    `<!doctype html><html><head><title>CSP fixture</title></head><body>${contents(nonce)}</body></html>`,
  );
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://fixture.invalid").pathname;
  if (path === CSP_REPORT_PATH && request.method === "POST") {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > 16_384) {
        response.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      // Record only the fields needed to prove real browser report delivery.
      reports.push({
        method: request.method,
        contentType: request.headers["content-type"],
        directive: parsed["csp-report"]?.["effective-directive"],
      });
      response.writeHead(204, { "cache-control": "no-store" }).end();
    } catch {
      response.writeHead(400).end();
    }
    return;
  }
  if (path === "/favicon.ico") {
    response.writeHead(204).end();
    return;
  }
  if (path === "/frames") {
    document(
      response,
      (nonce) => `
      <script nonce="${nonce}">
        window.frameMessages = [];
        addEventListener('message', (event) => {
          if (event.origin === location.origin) window.frameMessages.push(event.data);
        });
      </script>
      <iframe id="allowed" title="Allowed form" src="/f/token"></iframe>
      <iframe id="denied" title="Denied ordinary page" src="/ordinary"></iframe>
    `,
    );
    return;
  }
  if (path === "/f/token" || path === "/ordinary") {
    const form = path === "/f/token";
    document(
      response,
      (nonce) => `
      <h1>${form ? "Embedded form" : "Ordinary page"}</h1>
      ${form ? '<form><label>Name<input name="name"></label><button type="button" id="submit">Save</button></form>' : ""}
      <script nonce="${nonce}">
        parent.postMessage('${form ? "form-ready" : "ordinary-ready"}', location.origin);
        ${form ? "document.querySelector('#submit').addEventListener('click', () => parent.postMessage('form-interaction', location.origin));" : ""}
      </script>
    `,
      { sameOriginFrame: form },
    );
    return;
  }
  document(
    response,
    (nonce) => `
    <script nonce="${nonce}">
      window.proof = { trusted: true, inline: false, attribute: false };
      window.violations = [];
      addEventListener('securitypolicyviolation', (event) => window.violations.push(event.effectiveDirective));
    </script>
    <script>window.proof.inline = true;</script>
    <button id="injected" onclick="window.proof.attribute = true">Injected handler</button>
  `,
  );
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
  const first = await page.goto(origin);
  assert(first);
  const firstPolicy = first.headers()["content-security-policy"];
  await page.locator("#injected").click();
  assert.deepEqual(await page.evaluate(() => window.proof), {
    trusted: true,
    inline: false,
    attribute: false,
  });
  await expect
    .poll(() => page.evaluate(() => window.violations), { timeout: 5_000 })
    .toEqual(expect.arrayContaining(["script-src-elem", "script-src-attr"]));
  checks.push(
    "trusted nonce executes",
    "inline injection blocked",
    "event-handler injection blocked",
  );

  await expect
    .poll(() => reports.map((report) => report.directive), { timeout: 8_000 })
    .toEqual(expect.arrayContaining(["script-src-elem", "script-src-attr"]));
  assert(
    reports.every(
      (report) => report.method === "POST" && report.contentType === "application/csp-report",
    ),
  );
  checks.push("real browser CSP violation POST received");

  const second = await page.goto(origin);
  assert(second);
  assert.notEqual(
    firstPolicy.match(/'nonce-([^']+)'/)?.[1],
    second.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1],
  );
  checks.push("document nonce changes");

  await page.goto(`${origin}/frames`);
  await expect(
    page.frameLocator("#allowed").getByRole("heading", { name: "Embedded form" }),
  ).toBeVisible();
  await page.frameLocator("#allowed").getByLabel("Name").fill("Local fixture");
  await page.frameLocator("#allowed").getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => page.evaluate(() => window.frameMessages))
    .toEqual(expect.arrayContaining(["form-ready", "form-interaction"]));
  await expect
    .poll(() => reports.map((report) => report.directive), { timeout: 8_000 })
    .toContain("frame-ancestors");
  assert(!(await page.evaluate(() => window.frameMessages)).includes("ordinary-ready"));
  checks.push("same-origin form renders and handles input", "ordinary document framing denied");
  assert.equal(externalRequests.length, 0);
  checks.push("no external page requests");

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope:
          "Loopback fixture using actual production CSP builder; not LMS journeys or Next hydration",
        browser: browser.version(),
        channel: channel ?? "bundled chromium",
        checks,
        reportCount: reports.length,
        reportDirectives: [...new Set(reports.map((report) => report.directive))],
        externalRequests: externalRequests.length,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      { ok: false, checks, error: error instanceof Error ? error.message : "Browser proof failed" },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
