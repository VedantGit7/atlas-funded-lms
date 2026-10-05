import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Affiliate payout details at rest (audit M6).
 *
 * Bank account, IFSC, UPI id and account holder name used to be stored and
 * returned as plain text, so a database read, a backup or a support export
 * exposed every affiliate's banking details, and every admin and the learner
 * saw them in full on each page load.
 *
 * - AES-256-GCM, under a key derived (HKDF) from `LEARNER_BILLING_ENC_KEY`,
 *   which deployment validation already requires, so payment-gateway secrets
 *   and payout details never share a key.
 * - Each value is bound to its tenant, affiliate and field as additional
 *   authenticated data: a ciphertext copied to another affiliate or column
 *   fails to decrypt instead of silently paying someone else.
 * - Values written before this change are plain text. They are still read, so
 *   nothing breaks before the backfill (`pnpm data:encrypt-affiliate-payouts`)
 *   re-encrypts them; every write encrypts.
 *
 * Stored format: `enc:v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 */

export type PayoutField = "upi" | "bankAccount" | "ifsc" | "accountName";

export type PayoutDetails = {
  upi: string | null;
  bankAccount: string | null;
  ifsc: string | null;
  accountName: string | null;
};

export type PayoutBinding = { tenantId: string; affiliateId: string };

const PREFIX = "enc:v1:";
const KEY_INFO = "atlas/affiliate-payout-details/v1";

let cachedKey: { source: string; key: Buffer } | null = null;

function payoutKey(): Buffer {
  const raw = process.env["LEARNER_BILLING_ENC_KEY"];
  if (!raw) {
    throw new Error("LEARNER_BILLING_ENC_KEY is not configured.");
  }
  if (cachedKey?.source === raw) return cachedKey.key;
  const base = Buffer.from(raw, "base64");
  if (base.length !== 32) {
    throw new Error("LEARNER_BILLING_ENC_KEY must decode to exactly 32 bytes.");
  }
  const key = Buffer.from(hkdfSync("sha256", base, Buffer.alloc(0), KEY_INFO, 32));
  cachedKey = { source: raw, key };
  return key;
}

function aad(binding: PayoutBinding, field: PayoutField): Buffer {
  return Buffer.from(
    `affiliate-payout:${binding.tenantId}:${binding.affiliateId}:${field}`,
    "utf8",
  );
}

export function isEncryptedPayoutValue(stored: string | null): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

export function sealPayoutValue(
  value: string | null,
  binding: PayoutBinding,
  field: PayoutField,
): string | null {
  if (value == null || value === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", payoutKey(), iv);
  cipher.setAAD(aad(binding, field));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

export function openPayoutValue(
  stored: string | null,
  binding: PayoutBinding,
  field: PayoutField,
): string | null {
  if (stored == null || stored === "") return null;
  if (!isEncryptedPayoutValue(stored)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || dataB64 == null) {
    throw new Error("Malformed encrypted payout value.");
  }
  const decipher = createDecipheriv("aes-256-gcm", payoutKey(), Buffer.from(ivB64, "base64"));
  decipher.setAAD(aad(binding, field));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Row columns in, plain values out. */
export function openPayoutDetails(
  row: {
    payout_upi: string | null;
    payout_bank_account: string | null;
    payout_ifsc: string | null;
    payout_account_name: string | null;
  },
  binding: PayoutBinding,
): PayoutDetails {
  return {
    upi: openPayoutValue(row.payout_upi, binding, "upi"),
    bankAccount: openPayoutValue(row.payout_bank_account, binding, "bankAccount"),
    ifsc: openPayoutValue(row.payout_ifsc, binding, "ifsc"),
    accountName: openPayoutValue(row.payout_account_name, binding, "accountName"),
  };
}

/** A partial update in, encrypted column values out. `undefined` means unchanged. */
export function sealPayoutPatch(
  patch: {
    payoutUpi?: string | null | undefined;
    payoutBankAccount?: string | null | undefined;
    payoutIfsc?: string | null | undefined;
    payoutAccountName?: string | null | undefined;
  },
  binding: PayoutBinding,
): {
  payoutUpi?: string | null;
  payoutBankAccount?: string | null;
  payoutIfsc?: string | null;
  payoutAccountName?: string | null;
} {
  return {
    ...(patch.payoutUpi !== undefined
      ? { payoutUpi: sealPayoutValue(patch.payoutUpi, binding, "upi") }
      : {}),
    ...(patch.payoutBankAccount !== undefined
      ? { payoutBankAccount: sealPayoutValue(patch.payoutBankAccount, binding, "bankAccount") }
      : {}),
    ...(patch.payoutIfsc !== undefined
      ? { payoutIfsc: sealPayoutValue(patch.payoutIfsc, binding, "ifsc") }
      : {}),
    ...(patch.payoutAccountName !== undefined
      ? { payoutAccountName: sealPayoutValue(patch.payoutAccountName, binding, "accountName") }
      : {}),
  };
}

/** `•••• 1234`: enough to recognise an account, not enough to pay into it. */
export function maskBankAccount(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\s+/g, "");
  return `•••• ${digits.slice(-4)}`;
}

/** `ab•••@okhdfc`: the provider and a hint of the handle. */
export function maskUpi(value: string | null): string | null {
  if (!value) return null;
  const [handle = "", provider] = value.split("@");
  const visible = handle.slice(0, Math.min(2, Math.max(0, handle.length - 1)));
  return provider ? `${visible}•••@${provider}` : `${visible}•••`;
}

/** What screens show by default. Full values only come from the audited reveal. */
export function maskedPayoutView(details: PayoutDetails) {
  return {
    payoutUpiMasked: maskUpi(details.upi),
    payoutBankAccountMasked: maskBankAccount(details.bankAccount),
    payoutIfsc: details.ifsc,
    payoutAccountName: details.accountName,
    payoutDetailsOnFile: Boolean(details.upi || details.bankAccount),
  };
}

/** Field names that a patch changes, for audit entries that never carry values. */
export function changedPayoutFields(patch: Record<string, unknown>): string[] {
  return ["payoutUpi", "payoutBankAccount", "payoutIfsc", "payoutAccountName"].filter(
    (field) => patch[field] !== undefined,
  );
}
