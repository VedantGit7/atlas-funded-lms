import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Authenticated encryption for payment gateway secret keys (AES-256-GCM).
 *
 * SECURITY: the plaintext secret is only ever handled server-side. It is
 * encrypted here before it touches the database and is never returned to any
 * client. The 256-bit key is sourced from the `LEARNER_BILLING_ENC_KEY`
 * environment variable (base64, 32 bytes) so it can be provisioned from a
 * secrets manager / KMS rather than living in the codebase.
 *
 * Stored format: `v1:<iv b64>:<authTag b64>:<ciphertext b64>` with a fresh
 * random 96-bit IV per record.
 */
const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env["LEARNER_BILLING_ENC_KEY"];
  if (!raw) {
    throw new Error("LEARNER_BILLING_ENC_KEY is not configured.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("LEARNER_BILLING_ENC_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

export function encryptPaymentSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptPaymentSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed encrypted payment secret.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64 ?? "", "base64"));
  decipher.setAuthTag(Buffer.from(tagB64 ?? "", "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64 ?? "", "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** Last 4 characters of a secret, for a masked UI hint. */
export function secretLast4(secret: string): string {
  return secret.slice(-4);
}
