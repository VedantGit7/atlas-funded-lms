/**
 * Bitstring status list (stub) for credential revocation/suspension.
 *
 * Implements a pragmatic subset of the W3C Bitstring Status List spec: a
 * gzip-compressed, base64url-encoded bitstring where each certificate occupies
 * one bit at its `status_list_index`. `1` means the credential is no longer
 * valid (revoked or suspended). The encoded list is persisted on the
 * `certificate_status_lists` row and published from the public status-list
 * route as a `BitstringStatusListCredential`.
 */

import { gzipSync, gunzipSync } from "node:zlib";
import type { TenantTx } from "@atlas/db";
import { certificateRepository } from "./certificate.repository";

export const STATUS_LIST_PURPOSE = "revocation";
export const DEFAULT_STATUS_LIST_BITS = 131072; // 16 KiB of statuses.

export function encodeBitstring(bits: Uint8Array): string {
  return gzipSync(Buffer.from(bits)).toString("base64url");
}

export function decodeBitstring(encoded: string, byteLength: number): Uint8Array {
  const buffer = new Uint8Array(byteLength);
  if (!encoded) {
    return buffer;
  }
  try {
    const decompressed = gunzipSync(Buffer.from(encoded, "base64url"));
    buffer.set(decompressed.subarray(0, byteLength));
  } catch {
    // Corrupt/empty payload — fall back to an all-zero list.
  }
  return buffer;
}

function setBit(buffer: Uint8Array, index: number, value: boolean): void {
  const byteIndex = Math.floor(index / 8);
  if (byteIndex >= buffer.length) {
    throw new Error(`Status list index ${index} exceeds capacity.`);
  }
  const bitMask = 0x80 >> (index % 8);
  if (value) {
    buffer[byteIndex] = (buffer[byteIndex] ?? 0) | bitMask;
  } else {
    buffer[byteIndex] = (buffer[byteIndex] ?? 0) & ~bitMask;
  }
}

export function readBit(buffer: Uint8Array, index: number): boolean {
  const byteIndex = Math.floor(index / 8);
  const bitMask = 0x80 >> (index % 8);
  return ((buffer[byteIndex] ?? 0) & bitMask) !== 0;
}

export async function setCertificateStatusBit(args: {
  tx: TenantTx;
  tenantId: string;
  statusListIndex: number;
  revoked: boolean;
}): Promise<{ id: string; version: number }> {
  const list = await certificateRepository.findOrCreateStatusList(args.tx, {
    tenantId: args.tenantId,
    purpose: STATUS_LIST_PURPOSE,
    bitLength: DEFAULT_STATUS_LIST_BITS,
  });

  const byteLength = Math.ceil(list.bit_length / 8);
  const buffer = decodeBitstring(list.encoded_list, byteLength);
  setBit(buffer, args.statusListIndex, args.revoked);

  const encoded = encodeBitstring(buffer);
  const nextVersion = list.version + 1;
  await certificateRepository.updateStatusListEncoded(args.tx, {
    id: list.id,
    encodedList: encoded,
    version: nextVersion,
  });

  return { id: list.id, version: nextVersion };
}

export async function getEncodedStatusListCredential(args: {
  tx: TenantTx;
  tenantId: string;
  id: string;
  publicUrl: string;
}): Promise<{
  "@context": string[];
  id: string;
  type: string[];
  validFrom: string;
  credentialSubject: {
    id: string;
    type: string;
    statusPurpose: string;
    encodedList: string;
  };
} | null> {
  const list = await certificateRepository.findStatusListById(args.tx, args.id);
  if (!list || list.tenant_id !== args.tenantId) {
    return null;
  }

  return {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    id: args.publicUrl,
    type: ["VerifiableCredential", "BitstringStatusListCredential"],
    validFrom: list.updated_at.toISOString(),
    credentialSubject: {
      id: `${args.publicUrl}#list`,
      type: "BitstringStatusList",
      statusPurpose: list.purpose,
      encodedList: list.encoded_list,
    },
  };
}
