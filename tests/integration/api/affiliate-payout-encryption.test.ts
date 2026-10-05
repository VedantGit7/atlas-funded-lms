import { execFileSync } from "node:child_process";
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

  it("backfills rows written before encryption, and is safe to re-run", async () => {
    await asAdmin(
      (tx) => tx.$executeRaw`
        update sales_affiliates
           set payout_bank_account = '000011112222', payout_upi = 'legacy@okaxis'
         where id = ${affiliateId}::uuid
      `,
    );

    const run = (args: string[]) =>
      execFileSync(
        "pnpm",
        ["exec", "tsx", "scripts/data/encrypt-affiliate-payout-details.ts", ...args],
        {
          cwd: process.cwd(),
          shell: true,
          stdio: "pipe",
          env: {
            ...process.env,
            DIRECT_DATABASE_URL: process.env["DIRECT_DATABASE_URL"] ?? process.env["DATABASE_URL"],
            LEARNER_BILLING_ENC_KEY: KEY,
          },
        },
      ).toString();

    expect(run([])).toMatch(/[1-9]\d* affiliate\(s\) hold plain-text payout details\.\s+Dry run/);
    expect((await storedColumns()).payout_bank_account).toBe("000011112222");

    expect(run(["--apply"])).toMatch(/Encrypted [1-9]/);
    const stored = await storedColumns();
    expect(stored.payout_bank_account).toMatch(/^enc:v1:/);
    expect(stored.payout_upi).toMatch(/^enc:v1:/);
    expect(run([])).toMatch(/^0 affiliate\(s\)/m);

    const revealed = await asAdmin((tx) =>
      revealAffiliatePayoutDetails(tx, ctxFor(fixture.adminMembershipId), affiliateId),
    );
    expect(revealed.data).toMatchObject({
      payoutBankAccount: "000011112222",
      payoutUpi: "legacy@okaxis",
    });
  });
});
