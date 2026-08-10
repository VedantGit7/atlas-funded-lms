import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATEMENT_TIMEOUT_MS,
  DEFAULT_TENANT_TX_TIMEOUT_MS,
  DEFAULT_TX_MAX_WAIT_MS,
  interactiveTxOptions,
  resolveInteractiveTimeoutMs,
  resolveStatementTimeoutMs,
} from "../../../backend/packages/db/src/transaction-options";

describe("transaction-options", () => {
  it("defaults statement timeout to the tenants schema default", () => {
    expect(resolveStatementTimeoutMs()).toBe(DEFAULT_STATEMENT_TIMEOUT_MS);
    expect(resolveStatementTimeoutMs(null)).toBe(DEFAULT_STATEMENT_TIMEOUT_MS);
    expect(resolveStatementTimeoutMs(0)).toBe(DEFAULT_STATEMENT_TIMEOUT_MS);
    expect(resolveStatementTimeoutMs(-1)).toBe(DEFAULT_STATEMENT_TIMEOUT_MS);
  });

  it("accepts positive statement timeout overrides", () => {
    expect(resolveStatementTimeoutMs(12_000)).toBe(12_000);
    expect(resolveStatementTimeoutMs(1500.9)).toBe(1500);
  });

  it("keeps interactive timeout above the per-statement budget", () => {
    expect(resolveInteractiveTimeoutMs(DEFAULT_STATEMENT_TIMEOUT_MS)).toBe(
      DEFAULT_TENANT_TX_TIMEOUT_MS,
    );
    expect(resolveInteractiveTimeoutMs(10_000)).toBe(40_000);
  });

  it("builds prisma interactive transaction options", () => {
    expect(interactiveTxOptions(30_000)).toEqual({
      maxWait: DEFAULT_TX_MAX_WAIT_MS,
      timeout: 30_000,
    });
  });
});
