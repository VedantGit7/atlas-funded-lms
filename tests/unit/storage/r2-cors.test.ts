import { afterEach, describe, expect, it } from "vitest";
import {
  SIGNED_UPLOAD_HEADERS,
  UPLOAD_CORS_RULE,
  matchingUploadRule,
  planUploadCors,
  probeUploadPreflight,
  uploadProbeOrigins,
  type CorsRule,
} from "@atlas/storage/r2-cors";
import { R2StorageProvider } from "@atlas/storage/providers/r2-storage-provider";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import { syncR2UploadCors, type BucketCors } from "../../../scripts/storage/r2-cors-sync";
import { startFakeR2Preflight } from "./fake-r2-preflight";

/**
 * Audit M8: browsers PUT uploads straight to R2, so the bucket's CORS rule must
 * allow every header the presigner signs. These pin the two together and check
 * the command that applies and proves the rule.
 */

const CUSTOM_DOMAIN = "https://learn.some-academy.example";
const CONTENT_TYPE_ONLY: CorsRule = {
  AllowedOrigins: ["*"],
  AllowedMethods: ["PUT"],
  AllowedHeaders: ["content-type"],
};
const PUBLIC_GET: CorsRule = { AllowedOrigins: ["*"], AllowedMethods: ["GET"] };

describe("the signed headers and the CORS rule", () => {
  it("signs exactly the headers the CORS rule allows, and asks browsers to send no others", async () => {
    const env = parseStorageEnv({
      STORAGE_PROVIDER: "r2",
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET_NAME: "atlas-assets",
    });
    const signed = await new R2StorageProvider(env).createSignedUploadUrl({
      bucket: "atlas-assets",
      key: "t/logo.svg",
      contentType: "image/svg+xml",
      sizeBytes: 10,
      contentDisposition: "attachment",
      expiresInSeconds: 60,
    });

    const signedHeaders = (new URL(signed.url).searchParams.get("X-Amz-SignedHeaders") ?? "")
      .split(";")
      // The browser sets these itself; they never trigger a preflight.
      .filter((header) => header !== "host" && header !== "content-length");
    expect(signedHeaders.sort()).toEqual([...SIGNED_UPLOAD_HEADERS].sort());
    expect(Object.keys(signed.requiredHeaders).sort()).toEqual([...SIGNED_UPLOAD_HEADERS].sort());
    expect(UPLOAD_CORS_RULE.AllowedHeaders).toEqual([...SIGNED_UPLOAD_HEADERS]);
  });

  it("allows uploads from any tenant host, custom domains included, and only PUT", () => {
    for (const origin of ["https://academy.atlas.example", CUSTOM_DOMAIN]) {
      expect(matchingUploadRule([UPLOAD_CORS_RULE], origin)).toBe(UPLOAD_CORS_RULE);
    }
    expect(UPLOAD_CORS_RULE.AllowedMethods).toEqual(["PUT"]);
  });

  it("refuses a bucket whose rule lists only content-type: the M8 breakage", () => {
    expect(matchingUploadRule([CONTENT_TYPE_ONLY], CUSTOM_DOMAIN)).toBeNull();
    expect(matchingUploadRule([CONTENT_TYPE_ONLY], CUSTOM_DOMAIN, ["content-type"])).toBe(
      CONTENT_TYPE_ONLY,
    );
  });

  it("decides by the first rule that matches origin and method, as R2 does", () => {
    // A stale upload rule ahead of a correct one still breaks uploads.
    expect(matchingUploadRule([CONTENT_TYPE_ONLY, UPLOAD_CORS_RULE], CUSTOM_DOMAIN)).toBeNull();
    expect(matchingUploadRule([PUBLIC_GET, UPLOAD_CORS_RULE], CUSTOM_DOMAIN)).toBe(
      UPLOAD_CORS_RULE,
    );
  });

  it("matches one-wildcard origin patterns and headers case-insensitively", () => {
    const subdomains: CorsRule = {
      AllowedOrigins: ["https://*.atlas.example"],
      AllowedMethods: ["put"],
      AllowedHeaders: ["Content-Type", "Content-Disposition"],
    };
    expect(matchingUploadRule([subdomains], "https://a.atlas.example")).toBe(subdomains);
    expect(matchingUploadRule([subdomains], CUSTOM_DOMAIN)).toBeNull();
    expect(
      matchingUploadRule([{ ...subdomains, AllowedHeaders: ["*"] }], "https://a.atlas.example"),
    ).not.toBeNull();
  });
});

describe("planning the bucket configuration", () => {
  it("adds the upload rule to a bucket with none", () => {
    expect(planUploadCors([])).toMatchObject({ rules: [UPLOAD_CORS_RULE], changed: true });
  });

  it("replaces upload rules and keeps every other rule as it is", () => {
    const plan = planUploadCors([PUBLIC_GET, CONTENT_TYPE_ONLY]);
    expect(plan.rules).toEqual([UPLOAD_CORS_RULE, PUBLIC_GET]);
    expect(plan.replaced).toEqual([CONTENT_TYPE_ONLY]);
    expect(plan.kept).toEqual([PUBLIC_GET]);
    expect(plan.changed).toBe(true);
  });

  it("changes nothing when the rule is already in place, however R2 spells it", () => {
    const asStored: CorsRule = {
      AllowedOrigins: ["*"],
      AllowedMethods: ["put"],
      AllowedHeaders: ["Content-Disposition", "Content-Type"],
      MaxAgeSeconds: 3600,
    };
    expect(planUploadCors([asStored, PUBLIC_GET]).changed).toBe(false);
  });
});

describe("the live preflight", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });
  const start = async (rules: CorsRule[]) => {
    const server = await startFakeR2Preflight(rules);
    servers.push(server);
    return server;
  };

  it("sends what a browser sends, and passes when R2 allows it", async () => {
    const r2 = await start([UPLOAD_CORS_RULE]);
    await expect(probeUploadPreflight({ url: r2.url, origin: CUSTOM_DOMAIN })).resolves.toEqual({
      origin: CUSTOM_DOMAIN,
      ok: true,
      status: 200,
    });
    expect(r2.state.methods).toEqual(["OPTIONS"]);
    expect(r2.state.requests[0]).toMatchObject({
      origin: CUSTOM_DOMAIN,
      "access-control-request-method": "PUT",
      "access-control-request-headers": "content-type,content-disposition",
    });
  });

  it("fails, saying why, when R2 refuses it", async () => {
    const r2 = await start([CONTENT_TYPE_ONLY]);
    await expect(probeUploadPreflight({ url: r2.url, origin: CUSTOM_DOMAIN })).resolves.toEqual({
      origin: CUSTOM_DOMAIN,
      ok: false,
      status: 403,
      reason: "preflight answered 403",
    });
  });

  it("fails when R2 answers but leaves out a signed header", async () => {
    const r2 = await start([]);
    r2.state.respond = (res) =>
      res
        .writeHead(200, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, PUT",
          "access-control-allow-headers": "content-type",
        })
        .end();
    await expect(
      probeUploadPreflight({ url: r2.url, origin: CUSTOM_DOMAIN }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "Access-Control-Allow-Headers does not include content-disposition",
    });
  });

  it("reports an unreachable R2 without a status, distinct from a refusal", async () => {
    const r2 = await start([]);
    await r2.close();
    servers.pop();
    const result = await probeUploadPreflight({
      url: r2.url,
      origin: CUSTOM_DOMAIN,
      timeoutMs: 2000,
    });
    expect(result).toMatchObject({ ok: false, status: null });
    expect(result.reason).toMatch(/^preflight request failed/);
  });

  it("probes the platform host and a stand-in custom domain", () => {
    expect(uploadProbeOrigins("academy.atlas.example")).toEqual([
      "https://academy.atlas.example",
      "https://custom-domain.cors-probe.invalid",
    ]);
    expect(uploadProbeOrigins(undefined)).toEqual(["https://custom-domain.cors-probe.invalid"]);
  });
});

describe("pnpm storage:r2-cors", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function bucketWith(rules: CorsRule[]) {
    const r2 = await startFakeR2Preflight(rules);
    servers.push(r2);
    const writes: CorsRule[][] = [];
    const cors: BucketCors = {
      get: async () => r2.state.rules,
      put: async (next) => {
        writes.push(next);
        r2.state.pending = next;
      },
    };
    return { r2, cors, writes };
  }
  const origins = uploadProbeOrigins("academy.atlas.example");

  it("dry run: reports the broken rule and the failing preflight, and writes nothing", async () => {
    const { r2, cors, writes } = await bucketWith([CONTENT_TYPE_ONLY, PUBLIC_GET]);
    const report = await syncR2UploadCors({
      bucket: "atlas-assets",
      apply: false,
      cors,
      origins,
      probeUrl: async () => r2.url,
    });
    expect(writes).toEqual([]);
    expect(report).toMatchObject({ changed: true, written: false, ok: false, kept: [PUBLIC_GET] });
    expect(Object.values(report.allowedBefore)).toEqual([false, false]);
    expect(report.preflights.every((preflight) => preflight.status === 403)).toBe(true);
  });

  it("apply: writes the upload rule, keeps the others, and waits until R2 serves it", async () => {
    const { r2, cors, writes } = await bucketWith([CONTENT_TYPE_ONLY, PUBLIC_GET]);
    r2.state.servePendingAfter = 3; // the new rules reach the edge a little later
    const report = await syncR2UploadCors({
      bucket: "atlas-assets",
      apply: true,
      cors,
      origins,
      probeUrl: async () => r2.url,
      settleMs: 10,
    });
    expect(writes).toEqual([[UPLOAD_CORS_RULE, PUBLIC_GET]]);
    expect(report).toMatchObject({ written: true, ok: true });
    expect(report.preflights.map((preflight) => preflight.origin)).toEqual(origins);
  });

  it("apply on a correct bucket writes nothing and still proves it", async () => {
    const { r2, cors, writes } = await bucketWith([UPLOAD_CORS_RULE]);
    const report = await syncR2UploadCors({
      bucket: "atlas-assets",
      apply: true,
      cors,
      origins,
      probeUrl: async () => r2.url,
    });
    expect(writes).toEqual([]);
    expect(report).toMatchObject({ changed: false, written: false, ok: true });
  });
});
