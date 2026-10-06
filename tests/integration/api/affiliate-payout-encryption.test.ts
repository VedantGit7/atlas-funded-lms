import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";
import {
  createAffiliate,
  getMyAffiliate,
  listAffiliates,
  revealAffiliatePayoutDetails,
  updateAffiliate,
  updateMyAffiliatePayoutDetails,
} from "../../../backend/apps/api/src/server/sales-affiliates/sales-affiliates.service";
import {
  BackfillRefused,
  backfillAffiliatePayoutDetails,
} from "../../../scripts/data/affiliate-payout-backfill";

/**
 * Audit M6 against Postgres: payout details are ciphertext in the table, masked
 * in every default view, revealed only through the audited call, and the
 * backfill encrypts rows written before the change.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const KEY = Buffer.alloc(32, 9).toString("base64");

suite("affiliate payout details at rest (audit M6)", () => {
  let fixture: CourseAuthoringFixture;
  let affiliateId: string;
  const saved = process.env["LEARNER_BILLING_ENC_KEY"];
  const ctxFor = (membershipId: string) => ({
    tenantId: fixture.tenantId,
    actorMembershipId: membershipId,
    requestId: `req-m6-${membershipId.slice(0, 8)}`,
  });
  const asAdmin = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);
  const asLearner = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), fn);
  const storedColumns = () =>
    asAdmin(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          payout_upi: string | null;
          payout_bank_account: string | null;
          payout_ifsc: string | null;
          payout_account_name: string | null;
        }>
      >`
        select payout_upi, payout_bank_account, payout_ifsc, payout_account_name
          from sales_affiliates where id = ${affiliateId}::uuid
      `;
      const row = rows[0];
      if (!row) throw new Error("affiliate row missing");
      return row;
    });

  beforeAll(async () => {
    process.env["LEARNER_BILLING_ENC_KEY"] = KEY;
    fixture = await createCourseAuthoringFixture();
    const created = await asAdmin((tx) =>
      createAffiliate(tx, ctxFor(fixture.adminMembershipId), {
        membershipId: fixture.learnerMembershipId,
      }),
    );
    affiliateId = created.data.id;
  });

  afterAll(() => {
    if (saved === undefined) Reflect.deleteProperty(process.env, "LEARNER_BILLING_ENC_KEY");
    else process.env["LEARNER_BILLING_ENC_KEY"] = saved;
  });

  it("stores ciphertext, never the details", async () => {
    await asLearner((tx) =>
      updateMyAffiliatePayoutDetails(tx, ctxFor(fixture.learnerMembershipId), {
        payoutUpi: "ada.lovelace@okhdfc",
        payoutBankAccount: "123456789012",
        payoutIfsc: "HDFC0001234",
        payoutAccountName: "Ada Lovelace",
      }),
    );
    const stored = await storedColumns();
    for (const value of Object.values(stored)) expect(value).toMatch(/^enc:v1:/);
    expect(JSON.stringify(stored)).not.toContain("123456789012");
    expect(JSON.stringify(stored)).not.toContain("ada.lovelace");
  });

  it("shows the learner and admins masked values only", async () => {
    const mine = await asLearner((tx) => getMyAffiliate(tx, ctxFor(fixture.learnerMembershipId)));
    expect(mine.data).toMatchObject({
      payoutBankAccountMasked: "•••• 9012",
      payoutUpiMasked: "ad•••@okhdfc",
      payoutIfsc: "HDFC0001234",
      payoutDetailsOnFile: true,
    });

    const listed = await asAdmin((tx) => listAffiliates(tx, ctxFor(fixture.adminMembershipId), {}));
    const serialized = JSON.stringify([mine, listed]);
    expect(serialized).not.toContain("123456789012");
    expect(serialized).not.toContain("ada.lovelace");
  });

  it("keeps fields a save leaves out, so a masked form cannot erase them", async () => {
    await asLearner((tx) =>
      updateMyAffiliatePayoutDetails(tx, ctxFor(fixture.learnerMembershipId), {
        payoutAccountName: "Ada King",
      }),
    );
    const revealed = await asAdmin((tx) =>
      revealAffiliatePayoutDetails(tx, ctxFor(fixture.adminMembershipId), affiliateId),
    );
    expect(revealed.data).toMatchObject({
      payoutBankAccount: "123456789012",
      payoutUpi: "ada.lovelace@okhdfc",
      payoutAccountName: "Ada King",
    });
  });

  it("audits every reveal and every change, without the values", async () => {
    await asAdmin((tx) =>
      updateAffiliate(tx, ctxFor(fixture.adminMembershipId), affiliateId, { payoutUpi: null }),
    );
    const entries = await asAdmin(
      (tx) =>
        tx.$queryRaw<Array<{ action: string; body: string }>>`
        select action, coalesce(after_json::text, '') || coalesce(metadata_json::text, '') as body
          from audit_entries
         where target_id = ${affiliateId}
         order by occurred_at
      `,
    );
    const actions = entries.map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "affiliate.payout_details.updated",
        "affiliate.payout_details.revealed",
        "affiliate.partner.updated",
      ]),
    );
    const bodies = entries.map((entry) => entry.body).join(" ");
    expect(bodies).not.toContain("123456789012");
    expect(bodies).not.toContain("ada.lovelace");
    expect((await storedColumns()).payout_upi).toBeNull();
  });

  // The backfill works across tenants as the database owner. Each test limits
  // it to its own tenants, so it never touches rows other suites wrote.
  const ownerUrl = () => process.env["DIRECT_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  const backfill = (options: {
    apply: boolean;
    allowUnverifiedKey?: boolean;
    tenantIds?: string[];
  }) =>
    backfillAffiliatePayoutDetails({
      databaseUrl: ownerUrl(),
      tenantIds: [fixture.tenantId],
      ...options,
    });
  const writeLegacyPlainText = () =>
    asAdmin(
      (tx) => tx.$executeRaw`
        update sales_affiliates
           set payout_bank_account = '000011112222', payout_upi = 'legacy@okaxis'
         where id = ${affiliateId}::uuid
      `,
    );

  it("backfills rows written before encryption, proving the key, and is safe to re-run", async () => {
    await writeLegacyPlainText();

    const dryRun = await backfill({ apply: false });
    expect(dryRun).toMatchObject({
      plainTextAffiliates: 1,
      plainTextTenants: 1,
      plainTextValues: { bankAccount: 1, upi: 1, ifsc: 0, accountName: 0 },
      encrypted: 0,
      remaining: 1,
    });
    // IFSC and account name were encrypted by the API: the key opens them.
    expect(dryRun.key).toEqual({ verified: 2, failed: 0 });
    expect((await storedColumns()).payout_bank_account).toBe("000011112222");

    const applied = await backfill({ apply: true });
    expect(applied).toMatchObject({ encrypted: 1, failedIds: [], remaining: 0 });
    const stored = await storedColumns();
    expect(stored.payout_bank_account).toMatch(/^enc:v1:/);
    expect(stored.payout_upi).toMatch(/^enc:v1:/);

    const revealed = await asAdmin((tx) =>
      revealAffiliatePayoutDetails(tx, ctxFor(fixture.adminMembershipId), affiliateId),
    );
    expect(revealed.data).toMatchObject({
      payoutBankAccount: "000011112222",
      payoutUpi: "legacy@okaxis",
      payoutIfsc: "HDFC0001234",
      payoutAccountName: "Ada King",
    });

    const again = await backfill({ apply: true });
    expect(again).toMatchObject({ plainTextAffiliates: 0, encrypted: 0, remaining: 0 });
    expect(await storedColumns()).toEqual(stored);
  });

  it("exits 1 while plain text remains and 0 once it is gone, printing no values", async () => {
    await writeLegacyPlainText();
    const run = (args: string[]) =>
      spawnSync(
        "pnpm",
        [
          "exec",
          "tsx",
          "scripts/data/encrypt-affiliate-payout-details.ts",
          "--tenant",
          fixture.tenantId,
          ...args,
        ],
        {
          cwd: process.cwd(),
          shell: true,
          encoding: "utf8",
          env: { ...process.env, DIRECT_DATABASE_URL: ownerUrl(), LEARNER_BILLING_ENC_KEY: KEY },
        },
      );

    const dryRun = run([]);
    expect(dryRun.stdout).toMatch(/1 affiliate\(s\) hold plain-text payout details[\s\S]*Dry run/);
    expect(dryRun.status).toBe(1);

    const applied = run(["--apply"]);
    expect(applied.stdout).toMatch(/Encrypted 1/);
    expect(applied.status).toBe(0);
    expect(run([]).status).toBe(0);

    const output = [dryRun, applied].map((result) => result.stdout + result.stderr).join("");
    expect(output).not.toContain("000011112222");
    expect(output).not.toContain("legacy@okaxis");
  });

  it("refuses a key that does not decrypt what is stored, and changes nothing", async () => {
    await writeLegacyPlainText();
    process.env["LEARNER_BILLING_ENC_KEY"] = Buffer.alloc(32, 7).toString("base64");
    try {
      await expect(backfill({ apply: true })).rejects.toThrow(
        /does not decrypt 2 of 2 existing ciphertexts/,
      );
    } finally {
      process.env["LEARNER_BILLING_ENC_KEY"] = KEY;
    }
    expect((await storedColumns()).payout_bank_account).toBe("000011112222");
    await backfill({ apply: true });
  });

  it("refuses a login that row-level security would hide affiliates from", async () => {
    const role = `m6_backfill_${randomUUID().slice(0, 8)}`;
    const admin = new Client({ connectionString: ownerUrl() });
    await admin.connect();
    try {
      await admin.query(`create role ${role} login password 'm6-backfill-probe'`);
      await admin.query(`grant select, update on sales_affiliates, payment_gateways to ${role}`);
      const url = new URL(ownerUrl() ?? "");
      url.username = role;
      url.password = "m6-backfill-probe";
      await expect(
        backfillAffiliatePayoutDetails({ databaseUrl: url.toString(), apply: false }),
      ).rejects.toBeInstanceOf(BackfillRefused);
    } finally {
      await admin.query(`revoke all on sales_affiliates, payment_gateways from ${role}`);
      await admin.query(`drop role if exists ${role}`);
      await admin.end();
    }
  });

  it("needs --allow-unverified-key when no ciphertext can prove the key", async () => {
    const other = await createCourseAuthoringFixture();
    const created = await withTenantTx(authoringTenantTx(other, other.adminMembershipId), (tx) =>
      createAffiliate(
        tx,
        {
          tenantId: other.tenantId,
          actorMembershipId: other.adminMembershipId,
          requestId: "req-m6-key",
        },
        { membershipId: other.learnerMembershipId },
      ),
    );
    await withTenantTx(
      authoringTenantTx(other, other.adminMembershipId),
      (tx) => tx.$executeRaw`
        update sales_affiliates set payout_upi = 'first@okicici'
         where id = ${created.data.id}::uuid
      `,
    );
    const options = { tenantIds: [other.tenantId] };

    await expect(backfill({ ...options, apply: true })).rejects.toThrow(/--allow-unverified-key/);
    await expect(
      backfill({ ...options, apply: true, allowUnverifiedKey: true }),
    ).resolves.toMatchObject({ key: { verified: 0, failed: 0 }, encrypted: 1, remaining: 0 });
  });
});
