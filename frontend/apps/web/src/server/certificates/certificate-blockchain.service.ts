// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

/**
 * Certificate blockchain anchoring.
 *
 * Always computes a SHA-256 digest of the signed VC JSON (falling back to the
 * credential id) and stores it on `certificates.blockchain_anchor` as
 * `sha256:<hex>`. When `CERTIFICATE_BLOCKCHAIN_ANCHOR=true`, an optional chain
 * adapter may append a transaction reference (`|evm:0x…` / `|btc:…`).
 */

import { createHash } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { certificateRepository } from "./certificate.repository";
import { certificateNotFound } from "./certificate.errors";
import type { ServiceCtx } from "./certificate.types";

export type BlockchainAnchorResult = {
  certificateId: string;
  anchor: string;
  onChain: boolean;
  txRef: string | null;
  message?: string;
};

export type ChainAdapter = "local" | "op_return" | "evm";

export function isBlockchainAnchoringEnabled(): boolean {
  return process.env["CERTIFICATE_BLOCKCHAIN_ANCHOR"] === "true";
}

export function resolveChainAdapter(): ChainAdapter {
  const raw = (process.env["CERTIFICATE_CHAIN_ADAPTER"] ?? "local").trim().toLowerCase();
  if (raw === "op_return" || raw === "evm" || raw === "local") {
    return raw;
  }
  return "local";
}

export function computeCertificateHash(input: { vcJson?: unknown; credentialId: string }): string {
  const source = input.vcJson != null ? JSON.stringify(input.vcJson) : input.credentialId;
  const digest = createHash("sha256").update(source, "utf8").digest("hex");
  return `sha256:${digest}`;
}

type RpcJson = {
  result?: unknown;
  error?: { message?: string } | null;
};

async function bitcoinRpcCall(
  url: string,
  headers: Record<string, string>,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`BTC_RPC_HTTP_${String(response.status)}`);
  }
  const json = (await response.json()) as RpcJson;
  if (json.error) {
    throw new Error(json.error.message ?? "BTC_RPC_ERROR");
  }
  return json.result;
}

async function submitOpReturnAnchor(anchor: string): Promise<{
  onChain: boolean;
  txRef: string | null;
  message?: string;
}> {
  const rpcUrl = process.env["CERTIFICATE_BTC_RPC_URL"]?.trim();
  if (!rpcUrl) {
    return {
      onChain: false,
      txRef: null,
      message: "CERTIFICATE_BTC_RPC_URL not set; stored local hash only",
    };
  }

  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const user = process.env["CERTIFICATE_BTC_RPC_USER"]?.trim();
    const pass = process.env["CERTIFICATE_BTC_RPC_PASSWORD"]?.trim();
    if (user && pass) {
      headers["authorization"] = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
    }

    // OP_RETURN payload is limited (~80 bytes). Use the hex digest portion.
    const digestHex = anchor.startsWith("sha256:") ? anchor.slice("sha256:".length) : anchor;
    const dataHex = digestHex.slice(0, 80);

    const raw = (await bitcoinRpcCall(rpcUrl, headers, "createrawtransaction", [
      [],
      { data: dataHex },
    ])) as string;

    const funded = (await bitcoinRpcCall(rpcUrl, headers, "fundrawtransaction", [raw])) as {
      hex: string;
    };

    const signed = (await bitcoinRpcCall(rpcUrl, headers, "signrawtransactionwithwallet", [
      funded.hex,
    ])) as { hex: string; complete: boolean };

    if (!signed.complete) {
      return {
        onChain: false,
        txRef: null,
        message: "BTC wallet could not fully sign OP_RETURN transaction; local hash only",
      };
    }

    const txid = (await bitcoinRpcCall(rpcUrl, headers, "sendrawtransaction", [
      signed.hex,
    ])) as string;

    return { onChain: true, txRef: `btc:${txid}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OP_RETURN submit failed";
    return {
      onChain: false,
      txRef: null,
      message: `${message}; stored local hash only`,
    };
  }
}

async function submitEvmAnchor(anchor: string): Promise<{
  onChain: boolean;
  txRef: string | null;
  message?: string;
}> {
  const rpcUrl = process.env["CERTIFICATE_EVM_RPC_URL"]?.trim();
  const privateKey = process.env["CERTIFICATE_EVM_PRIVATE_KEY"]?.trim();
  if (!rpcUrl || !privateKey) {
    return {
      onChain: false,
      txRef: null,
      message:
        "CERTIFICATE_EVM_RPC_URL / CERTIFICATE_EVM_PRIVATE_KEY not set; stored local hash only",
    };
  }

  try {
    const { JsonRpcProvider, Wallet, hexlify, toUtf8Bytes } = await import("ethers");
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    const to = process.env["CERTIFICATE_EVM_TO_ADDRESS"]?.trim() || wallet.address;
    const tx = await wallet.sendTransaction({
      to,
      value: 0n,
      data: hexlify(toUtf8Bytes(anchor)),
    });
    return { onChain: true, txRef: `evm:${tx.hash}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "EVM submit failed";
    return {
      onChain: false,
      txRef: null,
      message: `${message}; stored local hash only`,
    };
  }
}

export async function anchorCertificateHash(
  tx: TenantTx,
  ctx: ServiceCtx,
  certificateId: string,
): Promise<BlockchainAnchorResult> {
  const certificate = await certificateRepository.findCertificateById(tx, certificateId);
  if (!certificate || certificate.tenant_id !== ctx.tenantId) {
    throw certificateNotFound();
  }

  const hash = computeCertificateHash({
    vcJson: certificate.vc_json,
    credentialId: certificate.credential_id,
  });

  let onChain = false;
  let txRef: string | null = null;
  let message: string | undefined;
  let anchor = hash;

  if (isBlockchainAnchoringEnabled()) {
    const adapter = resolveChainAdapter();
    if (adapter === "op_return") {
      const result = await submitOpReturnAnchor(hash);
      onChain = result.onChain;
      txRef = result.txRef;
      message = result.message;
    } else if (adapter === "evm") {
      const result = await submitEvmAnchor(hash);
      onChain = result.onChain;
      txRef = result.txRef;
      message = result.message;
    } else {
      onChain = false;
      message = "local adapter; hash stored only";
    }

    if (txRef) {
      anchor = `${hash}|${txRef}`;
    }
  }

  await certificateRepository.updateBlockchainAnchor(tx, {
    certificateId: certificate.id,
    anchor,
  });

  return {
    certificateId: certificate.id,
    anchor,
    onChain,
    txRef,
    ...(message ? { message } : {}),
  };
}
