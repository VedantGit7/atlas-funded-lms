import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import type JSZipModule from "jszip";
import type * as Forge from "node-forge";

/**
 * Apple Wallet issuance keeps object storage out of the request transaction
 * (audit H3 follow-up). The plan runs in the transaction; signing and upload
 * run after it, with no transaction open; a second, short transaction records
 * the stored object.
 */

const events = vi.hoisted(() => ({ log: [] as string[], inTx: false }));

vi.mock("@atlas/db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenantTx: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    events.log.push("tx:open");
    events.inTx = true;
    try {
      return await fn(fakeTx());
    } finally {
      events.inTx = false;
      events.log.push("tx:close");
    }
  }),
}));

vi.mock("../../../backend/apps/api/src/server/certificates/certificate-wallet-store", () => ({
  APPLE_PKPASS_CONTENT_TYPE: "application/vnd.apple.pkpass",
  storeCertificateWalletPass: vi.fn(async (args: { content: Buffer }) => {
    events.log.push(events.inTx ? "store:inside-tx" : "store:outside-tx");
    stored.content = args.content;
    return { objectKey: "tenant/certificate.wallet/cert/apple.pkpass" };
  }),
  loadCertificateWalletPass: vi.fn(async () => stored.content),
}));

const stored: { content: Buffer | null } = { content: null };

const certificateRow = {
  id: "018f0000-0000-7000-8000-000000000010",
  tenant_id: "018f0000-0000-7000-8000-000000000001",
  credential_id: "cred-apple-1",
  serial_number: "SN-1",
  recipient_name: "Ada",
  course_title: "Trading 101",
};

function fakeTx() {
  return {
    $queryRaw: vi.fn(async (sql: TemplateStringsArray) => {
      const text = sql.join("?").toLowerCase();
      if (text.includes("wallet")) {
        events.log.push(events.inTx ? "db:wallet-write" : "db:wallet-write-outside-tx");
        return [];
      }
      return [certificateRow];
    }),
    $executeRaw: vi.fn(async () => {
      events.log.push(events.inTx ? "db:wallet-write" : "db:wallet-write-outside-tx");
      return 1;
    }),
  };
}

import {
  completeAppleWalletPassIssue,
  planAppleWalletPassIssue,
} from "../../../backend/apps/api/src/server/certificates/certificate-wallet.service";

const ENV = [
  "CERTIFICATE_WALLETS",
  "APPLE_WALLET_PASS_TYPE_ID",
  "APPLE_WALLET_TEAM_ID",
  "APPLE_WALLET_CERT_PEM",
  "APPLE_WALLET_KEY_PEM",
  "APPLE_WALLET_WWDR_PEM",
] as const;
const saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));

const ctx = {
  tenantId: certificateRow.tenant_id,
  actorMembershipId: "018f0000-0000-7000-8000-000000000003",
  requestId: "req_apple_issue",
};

beforeAll(() => {
  // A throwaway self-signed signer, so the real PKCS#7 signing path runs.
  const forge = createRequire(new URL("../../../backend/apps/api/package.json", import.meta.url))(
    "node-forge",
  ) as typeof Forge;
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 3_600_000);
  const attrs = [{ name: "commonName", value: "Pass Type ID: pass.test.atlas" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  const certPem = forge.pki.certificateToPem(cert);

  process.env["CERTIFICATE_WALLETS"] = "true";
  process.env["APPLE_WALLET_PASS_TYPE_ID"] = "pass.test.atlas";
  process.env["APPLE_WALLET_TEAM_ID"] = "TEAM123456";
  process.env["APPLE_WALLET_CERT_PEM"] = certPem;
  process.env["APPLE_WALLET_KEY_PEM"] = forge.pki.privateKeyToPem(keys.privateKey);
  process.env["APPLE_WALLET_WWDR_PEM"] = certPem;
});

afterAll(() => {
  for (const key of ENV) {
    const value = saved[key];
    if (value === undefined) Reflect.deleteProperty(process.env, key);
    else process.env[key] = value;
  }
});

beforeEach(() => {
  events.log = [];
  events.inTx = false;
  stored.content = null;
});

describe("Apple Wallet issuance around the request transaction", () => {
  it("plans inside the transaction without touching storage", async () => {
    events.inTx = true; // the route's request transaction
    const plan = await planAppleWalletPassIssue(fakeTx() as never, ctx, certificateRow.id);
    events.inTx = false;

    expect(plan.kind).toBe("build");
    expect(events.log.filter((entry) => entry.startsWith("store:"))).toEqual([]);
  });

  it("signs and uploads with no transaction open, then records the object in its own", async () => {
    const plan = await planAppleWalletPassIssue(fakeTx() as never, ctx, certificateRow.id);
    const result = await completeAppleWalletPassIssue(plan, ctx);

    expect(result.data).toMatchObject({
      platform: "apple",
      status: "active",
      passObjectKey: "tenant/certificate.wallet/cert/apple.pkpass",
      downloadUrl: `/api/v1/certificates/${certificateRow.id}/wallet/apple/download`,
    });
    expect(events.log[0]).toBe("store:outside-tx");
    expect(events.log.slice(1)).toEqual(
      expect.arrayContaining(["tx:open", "db:wallet-write", "tx:close"]),
    );
    expect(events.log).not.toContain("store:inside-tx");
  });

  it("builds a pass bundle with Apple's file names and a signed manifest", async () => {
    const plan = await planAppleWalletPassIssue(fakeTx() as never, ctx, certificateRow.id);
    await completeAppleWalletPassIssue(plan, ctx);

    // jszip is the API app's dependency, so resolve it from there.
    const apiRequire = createRequire(
      new URL("../../../backend/apps/api/package.json", import.meta.url),
    );
    const JSZip = apiRequire("jszip") as typeof JSZipModule;
    const zip = await JSZip.loadAsync(stored.content ?? Buffer.alloc(0));
    expect(Object.keys(zip.files).sort()).toEqual([
      "icon.png",
      "icon@2x.png",
      "logo.png",
      "logo@2x.png",
      "manifest.json",
      "pass.json",
      "signature",
    ]);
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) throw new Error("pass bundle has no manifest.json");
    const manifest = JSON.parse(await manifestFile.async("string")) as Record<string, string>;
    expect(Object.keys(manifest).sort()).toEqual([
      "icon.png",
      "icon@2x.png",
      "logo.png",
      "logo@2x.png",
      "pass.json",
    ]);
  });

  it("does not record a pass for a certificate that disappeared during the upload", async () => {
    const plan = await planAppleWalletPassIssue(fakeTx() as never, ctx, certificateRow.id);
    const { withTenantTx } = await import("@atlas/db");
    vi.mocked(withTenantTx).mockImplementationOnce(async (_ctx, fn) =>
      fn({ $queryRaw: vi.fn(async () => []), $executeRaw: vi.fn(async () => 1) } as never),
    );

    await expect(completeAppleWalletPassIssue(plan, ctx)).rejects.toMatchObject({ status: 404 });
  });
});
