import { afterEach, describe, expect, it } from "vitest";
import {
  computeCertificateHash,
  isBlockchainAnchoringEnabled,
  resolveChainAdapter,
} from "../../../backend/apps/api/src/server/certificates/certificate-blockchain.service";
import { isCertificateFeatureEnabled } from "../../../backend/apps/api/src/server/certificates/certificate-feature-flags";
import {
  completeAppleWalletPassIssue,
  issueGoogleWalletPass,
  planAppleWalletPassIssue,
} from "../../../backend/apps/api/src/server/certificates/certificate-wallet.service";

type IssueCtx = Parameters<typeof planAppleWalletPassIssue>[1];

/** The route's two phases: plan in the transaction, complete after it. */
async function issueAppleWalletPass(tx: never, ctx: IssueCtx, certificateId: string) {
  return completeAppleWalletPassIssue(await planAppleWalletPassIssue(tx, ctx, certificateId), ctx);
}

const ENV_KEYS = [
  "CERTIFICATE_WALLETS",
  "CERTIFICATE_BLOCKCHAIN_ANCHOR",
  "CERTIFICATE_CHAIN_ADAPTER",
  "APPLE_WALLET_PASS_TYPE_ID",
  "APPLE_WALLET_TEAM_ID",
  "APPLE_WALLET_CERT_PEM",
  "APPLE_WALLET_KEY_PEM",
  "APPLE_WALLET_WWDR_PEM",
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      // omit dynamic key without `delete obj[key]` (no-dynamic-delete)
      const { [key]: _omit, ..._rest } = process.env;
      void _omit;
      void _rest;
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
});

describe("certificate wallet feature gate", () => {
  it("returns not_configured WALLET_FEATURE_DISABLED when wallets flag is off", async () => {
    process.env["CERTIFICATE_WALLETS"] = "false";
    Reflect.deleteProperty(process.env, "APPLE_WALLET_PASS_TYPE_ID");

    expect(isCertificateFeatureEnabled("wallets")).toBe(false);

    const tx = {
      $queryRaw: async () => [
        {
          id: "018f0000-0000-7000-8000-000000000010",
          tenant_id: "018f0000-0000-7000-8000-000000000001",
          template_id: "018f0000-0000-7000-8000-000000000002",
          membership_id: "018f0000-0000-7000-8000-000000000003",
          credential_id: "cred-test-1",
          status: "issued",
          issued_at: new Date("2026-01-01T00:00:00.000Z"),
          revoked_at: null,
          r2_object_key: null,
          metadata_json: {},
          expires_at: null,
          suspended_at: null,
          serial_number: "SN-1",
          design_snapshot_json: {},
          design_snapshot_hash: null,
          recipient_name: "Ada",
          course_title: "Trading 101",
          status_list_index: null,
          vc_json: { id: "vc-1" },
          vc_object_key: null,
          blockchain_anchor: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      $executeRaw: async () => 1,
    };

    const ctx = {
      tenantId: "018f0000-0000-7000-8000-000000000001",
      actorMembershipId: "018f0000-0000-7000-8000-000000000003",
      requestId: "req_wallet_flag",
    };

    // Bypass repository by mocking at module level is heavy; call after enabling
    // feature briefly to exercise not_configured without Apple env instead.
    process.env["CERTIFICATE_WALLETS"] = "true";
    const apple = await issueAppleWalletPass(
      tx as never,
      ctx,
      "018f0000-0000-7000-8000-000000000010",
    );
    expect(apple.data.status).toBe("not_configured");
    expect(apple.data.message).toContain("Apple Wallet is not configured");

    const google = await issueGoogleWalletPass(
      tx as never,
      ctx,
      "018f0000-0000-7000-8000-000000000010",
    );
    expect(google.data.status).toBe("not_configured");
    expect(google.data.message).toContain("Google Wallet is not configured");

    process.env["CERTIFICATE_WALLETS"] = "false";
    const disabled = await issueAppleWalletPass(
      tx as never,
      ctx,
      "018f0000-0000-7000-8000-000000000010",
    );
    expect(disabled.data.status).toBe("not_configured");
    expect(disabled.data.message).toBe("WALLET_FEATURE_DISABLED");
  });
});

describe("certificate blockchain hash", () => {
  it("is deterministic for the same VC payload", () => {
    const vc = { type: ["VerifiableCredential"], id: "urn:cred:1" };
    expect(computeCertificateHash({ vcJson: vc, credentialId: "ignored" })).toBe(
      computeCertificateHash({ vcJson: vc, credentialId: "ignored" }),
    );
    expect(computeCertificateHash({ vcJson: vc, credentialId: "ignored" })).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
  });

  it("falls back to credential id when VC is absent", () => {
    expect(computeCertificateHash({ credentialId: "cred-abc" })).toBe(
      computeCertificateHash({ credentialId: "cred-abc" }),
    );
    expect(computeCertificateHash({ credentialId: "cred-abc" })).not.toBe(
      computeCertificateHash({ credentialId: "cred-xyz" }),
    );
  });

  it("defaults chain adapter to local", () => {
    Reflect.deleteProperty(process.env, "CERTIFICATE_CHAIN_ADAPTER");
    expect(resolveChainAdapter()).toBe("local");
    process.env["CERTIFICATE_CHAIN_ADAPTER"] = "evm";
    expect(resolveChainAdapter()).toBe("evm");
    process.env["CERTIFICATE_BLOCKCHAIN_ANCHOR"] = "true";
    expect(isBlockchainAnchoringEnabled()).toBe(true);
  });
});
