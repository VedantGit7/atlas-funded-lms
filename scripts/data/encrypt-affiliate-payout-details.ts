/**
 * Encrypts affiliate payout details written before audit M6.
 *
 *   DIRECT_DATABASE_URL=... LEARNER_BILLING_ENC_KEY=... pnpm data:encrypt-affiliate-payouts
 *   ... pnpm data:encrypt-affiliate-payouts -- --apply
 *
 * Dry run by default: it reports how many affiliates still hold plain text,
 * and whether the key decrypts what the database already holds. With
 * `--apply` it encrypts them. `--tenant <id>` (repeatable) limits the run to
 * those tenants, to try one first. Safe to re-run. See
 * `scripts/data/affiliate-payout-backfill.ts` for what it guarantees, and
 * docs/runbooks/affiliate-payout-details.md for when to run it.
 *
 * Exit codes: 0 when no plain text remains, 1 when some does (a dry run that
 * found work, or an apply that could not finish), 2 when it refused to run.
 */
import { backfillAffiliatePayoutDetails } from "./affiliate-payout-backfill";
import { tenantArgs } from "./backfill-connection";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const tenantIds = tenantArgs(args);

backfillAffiliatePayoutDetails({
  databaseUrl: process.env["DIRECT_DATABASE_URL"],
  apply,
  allowUnverifiedKey: args.includes("--allow-unverified-key"),
  tenantIds,
})
  .then((report) => {
    const values = report.plainTextValues;
    console.log(
      `Database: ${report.database}` +
        (tenantIds.length > 0 ? ` (tenants ${tenantIds.join(", ")})` : " (all tenants)"),
    );
    console.log(
      report.key.verified > 0
        ? `Key: decrypts ${String(report.key.verified)} existing ciphertext(s).`
        : "Key: no existing ciphertext to check it against.",
    );
    console.log(
      `${String(report.plainTextAffiliates)} affiliate(s) hold plain-text payout details` +
        ` across ${String(report.plainTextTenants)} tenant(s)` +
        ` (bank account ${String(values.bankAccount)}, UPI ${String(values.upi)},` +
        ` IFSC ${String(values.ifsc)}, account name ${String(values.accountName)}).`,
    );
    if (!report.apply) {
      if (report.plainTextAffiliates > 0)
        console.log("Dry run. Re-run with --apply to encrypt them.");
    } else if (report.plainTextAffiliates > 0) {
      console.log(
        `Encrypted ${String(report.encrypted)}; ${String(report.alreadyEncrypted)} already encrypted meanwhile.`,
      );
      if (report.failedIds.length > 0) {
        console.log(`Could not encrypt (left unchanged): ${report.failedIds.join(", ")}`);
      }
      console.log(`${String(report.remaining)} affiliate(s) still hold plain text.`);
    }
    process.exit(report.remaining === 0 ? 0 : 1);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  });
