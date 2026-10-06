import { Client } from "pg";
import { decryptPaymentSecret } from "../../backend/packages/domain/config/src/payment-secret-crypto";
import {
  isEncryptedPayoutValue,
  openPayoutValue,
  sealPayoutValue,
  type PayoutField,
} from "../../backend/apps/api/src/server/sales-affiliates/affiliate-payout-details";

/**
 * The audit M6 backfill: encrypt affiliate payout details written as plain
 * text before encryption at rest. `scripts/data/encrypt-affiliate-payout-details.ts`
 * is the command; this is the work, so it can be tested against Postgres.
 *
 * Three things make it safe to point at production:
 *
 * - **It sees every row or refuses.** `sales_affiliates` forces row-level
 *   security and has no policy for the owner role, so an owner login without
 *   BYPASSRLS sees no rows at all: a dry run would report a clean table that
 *   is not, and `--apply` would encrypt nothing. The login must be a superuser
 *   or have BYPASSRLS, and row security is turned off for the session, so a
 *   filtered read errors instead of returning less.
 * - **It proves the key before writing.** Encrypting with the wrong
 *   `LEARNER_BILLING_ENC_KEY` would make every affiliate's details unreadable
 *   to the API. The key must decrypt the ciphertext already in the database
 *   (payment gateway secrets and payout values encrypted since M6). If there
 *   is none to check against, `--apply` needs `--allow-unverified-key`.
 * - **It verifies every value it writes.** Each affiliate is handled in its own
 *   short transaction: the row is locked, each plain value sealed, the sealed
 *   value opened again and compared before the update, and committed only if
 *   all of them round-trip. A concurrent edit waits for the lock and is never
 *   overwritten; a value already encrypted is left alone.
 *
 * It never prints a payout value, only counts and affiliate ids.
 */

type Row = {
  id: string;
  tenant_id: string;
  payout_upi: string | null;
  payout_bank_account: string | null;
  payout_ifsc: string | null;
  payout_account_name: string | null;
};

type Column = Exclude<keyof Row, "id" | "tenant_id">;

const COLUMNS: ReadonlyArray<readonly [Column, PayoutField]> = [
  ["payout_upi", "upi"],
  ["payout_bank_account", "bankAccount"],
  ["payout_ifsc", "ifsc"],
  ["payout_account_name", "accountName"],
];

const SELECT_ROW = `select id::text, tenant_id::text, payout_upi, payout_bank_account, payout_ifsc, payout_account_name
  from sales_affiliates`;

const PLAIN_TEXT = COLUMNS.map(
  ([column]) => `(${column} is not null and ${column} <> '' and ${column} not like 'enc:v1:%')`,
).join(" or ");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How many existing ciphertexts to decrypt as proof of the key. */
const KEY_SAMPLE = 50;

const needsEncryption = (value: string | null): value is string =>
  value != null && value !== "" && !isEncryptedPayoutValue(value);

export type KeyCheck = {
  /** Existing ciphertexts the key decrypted. */
  verified: number;
  /** Existing ciphertexts it failed to decrypt. Any at all means a wrong key. */
  failed: number;
};

export type BackfillReport = {
  database: string;
  apply: boolean;
  key: KeyCheck;
  /** Affiliates holding at least one plain-text value when the run started. */
  plainTextAffiliates: number;
  plainTextTenants: number;
  plainTextValues: Record<PayoutField, number>;
  encrypted: number;
  /** Affiliates that no longer held plain text once locked (edited meanwhile). */
  alreadyEncrypted: number;
  /** Affiliates left unchanged because encrypting them failed (rolled back). */
  failedIds: string[];
  /** Affiliates still holding plain text when the run finished. */
  remaining: number;
};

export class BackfillRefused extends Error {}

export async function backfillAffiliatePayoutDetails(options: {
  databaseUrl: string | undefined;
  apply: boolean;
  allowUnverifiedKey?: boolean;
  /** Limit the run (and the key check) to these tenants, e.g. one tenant first. */
  tenantIds?: readonly string[];
}): Promise<BackfillReport> {
  if (!options.databaseUrl) {
    throw new BackfillRefused("DIRECT_DATABASE_URL (database owner) is required.");
  }
  if (!process.env["LEARNER_BILLING_ENC_KEY"]) {
    throw new BackfillRefused(
      "LEARNER_BILLING_ENC_KEY is required: it must be the key the API decrypts with.",
    );
  }

  const badTenant = options.tenantIds?.find((id) => !UUID.test(id));
  if (badTenant !== undefined) {
    throw new BackfillRefused(`--tenant expects a tenant id (uuid); got "${badTenant}".`);
  }

  const client = new Client({
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    const identity = (
      await client.query<{ database: string; complete_visibility: boolean }>(
        `select current_database() as database,
                (select rolsuper or rolbypassrls from pg_roles where rolname = current_user) as complete_visibility`,
      )
    ).rows[0];
    if (!identity?.complete_visibility) {
      throw new BackfillRefused(
        "This login cannot see every tenant's affiliates (sales_affiliates forces row-level security). " +
          "Use the database owner with BYPASSRLS, or a superuser.",
      );
    }
    // A read row security would filter now errors instead of returning less.
    await client.query("set row_security = off");

    const scope = tenantScope(options.tenantIds);
    const key = await checkKey(client, scope);
    if (key.failed > 0) {
      throw new BackfillRefused(
        `LEARNER_BILLING_ENC_KEY does not decrypt ${String(key.failed)} of ${String(key.failed + key.verified)} ` +
          "existing ciphertexts: it is not the key this database was encrypted with. Nothing was changed.",
      );
    }

    const plain = (
      await client.query<Row>(
        `${SELECT_ROW} where (${PLAIN_TEXT}) ${scope.sql(1)} order by id`,
        scope.params,
      )
    ).rows;
    const report: BackfillReport = {
      database: identity.database,
      apply: options.apply,
      key,
      plainTextAffiliates: plain.length,
      plainTextTenants: new Set(plain.map((row) => row.tenant_id)).size,
      plainTextValues: { upi: 0, bankAccount: 0, ifsc: 0, accountName: 0 },
      encrypted: 0,
      alreadyEncrypted: 0,
      failedIds: [],
      remaining: plain.length,
    };
    for (const row of plain) {
      for (const [column, field] of COLUMNS) {
        if (needsEncryption(row[column])) report.plainTextValues[field] += 1;
      }
    }
    if (!options.apply || plain.length === 0) return report;

    if (key.verified === 0 && !options.allowUnverifiedKey) {
      throw new BackfillRefused(
        "There is no existing ciphertext to prove LEARNER_BILLING_ENC_KEY is the API's key. " +
          "Check it against the deployment's secret, then re-run with --allow-unverified-key.",
      );
    }

    for (const { id } of plain) {
      await client.query("begin");
      try {
        const row = (await client.query<Row>(`${SELECT_ROW} where id = $1::uuid for update`, [id]))
          .rows[0];
        if (!row || !COLUMNS.some(([column]) => needsEncryption(row[column]))) {
          await client.query("rollback");
          report.alreadyEncrypted += 1;
          continue;
        }
        const binding = { tenantId: row.tenant_id, affiliateId: row.id };
        const next = COLUMNS.map(([column, field]) => {
          const value = row[column];
          if (!needsEncryption(value)) return value;
          const sealed = sealPayoutValue(value, binding, field);
          if (openPayoutValue(sealed, binding, field) !== value) {
            throw new Error(`sealed ${field} did not round-trip`);
          }
          return sealed;
        });
        await client.query(
          `update sales_affiliates
              set payout_upi = $2, payout_bank_account = $3, payout_ifsc = $4, payout_account_name = $5
            where id = $1::uuid`,
          [row.id, ...next],
        );
        await client.query("commit");
        report.encrypted += 1;
      } catch {
        await client.query("rollback");
        report.failedIds.push(id);
      }
    }

    report.remaining = Number(
      (
        await client.query<{ n: string }>(
          `select count(*) as n from sales_affiliates where (${PLAIN_TEXT}) ${scope.sql(1)}`,
          scope.params,
        )
      ).rows[0]?.n ?? 0,
    );
    return report;
  } finally {
    await client.end();
  }
}

type Scope = { sql: (position: number) => string; params: unknown[] };

function tenantScope(tenantIds: readonly string[] | undefined): Scope {
  if (!tenantIds || tenantIds.length === 0) return { sql: () => "", params: [] };
  return {
    sql: (position) => `and tenant_id = any($${String(position)}::uuid[])`,
    params: [tenantIds],
  };
}

/** Decrypt a sample of the ciphertext already stored under this key. */
async function checkKey(client: Client, scope: Scope): Promise<KeyCheck> {
  const check: KeyCheck = { verified: 0, failed: 0 };
  const attempt = (open: () => unknown) => {
    try {
      open();
      check.verified += 1;
    } catch {
      check.failed += 1;
    }
  };

  const gateways = await client.query<{ secret_ciphertext: string }>(
    `select secret_ciphertext from payment_gateways
      where secret_ciphertext like 'v1:%' ${scope.sql(2)} order by id limit $1`,
    [KEY_SAMPLE, ...scope.params],
  );
  for (const { secret_ciphertext } of gateways.rows) {
    attempt(() => decryptPaymentSecret(secret_ciphertext));
  }

  const affiliates = await client.query<Row>(
    `${SELECT_ROW}
      where (${COLUMNS.map(([column]) => `${column} like 'enc:v1:%'`).join(" or ")}) ${scope.sql(2)}
      order by id limit $1`,
    [KEY_SAMPLE, ...scope.params],
  );
  for (const row of affiliates.rows) {
    const binding = { tenantId: row.tenant_id, affiliateId: row.id };
    for (const [column, field] of COLUMNS) {
      const value = row[column];
      if (isEncryptedPayoutValue(value)) attempt(() => openPayoutValue(value, binding, field));
    }
  }
  return check;
}
