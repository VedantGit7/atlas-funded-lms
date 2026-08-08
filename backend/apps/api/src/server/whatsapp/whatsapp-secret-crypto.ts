import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for WhatsApp Cloud API access tokens.
 * Key: WHATSAPP_ENC_KEY (preferred) or LEARNER_BILLING_ENC_KEY (fallback), base64 32 bytes.
 * Format: v1:<iv>:<tag>:<ciphertext>
 */
const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env["WHATSAPP_ENC_KEY"] ?? process.env["LEARNER_BILLING_ENC_KEY"];
  if (!raw) {
    throw new Error("WHATSAPP_ENC_KEY (or LEARNER_BILLING_ENC_KEY) is not configured.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("WhatsApp encryption key must decode to exactly 32 bytes.");
  }
  return key;
}

export function encryptWhatsappSecret(plaintext: string): string {
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

export function decryptWhatsappSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed encrypted WhatsApp secret.");
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

export function whatsappSecretLast4(secret: string): string {
  return secret.slice(-4);
}
