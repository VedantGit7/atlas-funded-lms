/**
 * Encrypts affiliate payout details written before audit M6.
 *
 *   DIRECT_DATABASE_URL=... LEARNER_BILLING_ENC_KEY=... pnpm data:encrypt-affiliate-payouts
 *   ... pnpm data:encrypt-affiliate-payouts -- --apply
 *
 * Dry run by default: it reports how many rows still hold plain text. With
 * `--apply` it encrypts them. It is safe to re-run: encrypted values are left
 * alone, and each row is only updated if it still holds the values it read, so
 * a concurrent edit is never overwritten. It needs the database owner
 * connection (DIRECT_DATABASE_URL) because it works across tenants.
 *
 * Run it once after deploying M6, then confirm the dry run reports 0.
 */
import { Client } from "pg";
import {
  isEncryptedPayoutValue,
  sealPayoutValue,
  type PayoutField,
} from "../../backend/apps/api/src/server/sales-affiliates/affiliate-payout-details";

type Row = {
  id: string;
  tenant_id: string;
  payout_upi: string | null;
  payout_bank_account: string | null;
  payout_ifsc: string | null;
  payout_account_name: string | null;
};

const COLUMNS: Array<[keyof Row, PayoutField]> = [
  ["payout_upi", "upi"],
  ["payout_bank_account", "bankAccount"],
  ["payout_ifsc", "ifsc"],
  ["payout_account_name", "accountName"],
];

const needsEncryption = (value: string | null) =>
  value != null && value !== "" && !isEncryptedPayoutValue(value);

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env["DIRECT_DATABASE_URL"];
  if (!url) throw new Error("DIRECT_DATABASE_URL (database owner) is required.");
  if (!process.env["LEARNER_BILLING_ENC_KEY"]) {
    throw new Error("LEARNER_BILLING_ENC_KEY is required: it is the key the API decrypts with.");
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<Row>(
      `select id::text, tenant_id::text, payout_upi, payout_bank_account, payout_ifsc, payout_account_name
         from sales_affiliates
        where ${COLUMNS.map(([column]) => `(${column} is not null and ${column} <> '' and ${column} not like 'enc:v1:%')`).join(" or ")}`,
    );

    console.log(`${String(rows.length)} affiliate(s) hold plain-text payout details.`);
    if (!apply) {
      if (rows.length > 0) console.log("Dry run. Re-run with --apply to encrypt them.");
      return;
    }

    let updated = 0;
    for (const row of rows) {
      const binding = { tenantId: row.tenant_id, affiliateId: row.id };
      const next = COLUMNS.map(([column, field]) => {
        const value = row[column];
        return needsEncryption(value) ? sealPayoutValue(value, binding, field) : value;
      });
      const result = await client.query(
        `update sales_affiliates
            set payout_upi = $2, payout_bank_account = $3, payout_ifsc = $4, payout_account_name = $5
          where id = $1::uuid
            and payout_upi is not distinct from $6
            and payout_bank_account is not distinct from $7
            and payout_ifsc is not distinct from $8
            and payout_account_name is not distinct from $9`,
        [
          row.id,
          ...next,
          row.payout_upi,
          row.payout_bank_account,
          row.payout_ifsc,
          row.payout_account_name,
        ],
      );
      updated += result.rowCount ?? 0;
    }
    console.log(
      `Encrypted ${String(updated)} of ${String(rows.length)}; re-run to pick up any edited meanwhile.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
