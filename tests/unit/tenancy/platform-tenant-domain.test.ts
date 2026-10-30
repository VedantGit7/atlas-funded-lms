import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformTx } from "@atlas/db";

/**
 * Custom domains: added pending, verified by their TXT record, then made
 * primary. Until this existed nothing ever activated a custom domain, so a
 * tenant's own domain could never serve it (launch plan 2.6).
 */

const mocks = vi.hoisted(() => ({ auditWrite: vi.fn() }));
vi.mock("@atlas/audit", () => ({ auditWriter: { write: mocks.auditWrite } }));

import {
  addPlatformTenantCustomDomain,
  normalizeCustomHostname,
  setPlatformTenantPrimaryDomain,
  verifyPlatformTenantDomain,
} from "@atlas/domain-tenancy/services/platform-tenant-domain.service";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const domainId = "018f0000-0000-7000-8000-000000000002";
const ctx = {
  platformPrincipalId: "018f0000-0000-7000-8000-000000000003",
  requestId: "req_domain_test",
  reason: "Launch plan 2.6 staging tenant domain",
};
const txtName = "_atlas-verify.academy.acme-learning.example.com";
const txtValue = "atlas=0123456789abcdef";

function domainRow(overrides: Record<string, unknown> = {}) {
  return {
    id: domainId,
    hostname: "academy.acme-learning.example.com",
    type: "CUSTOM_DOMAIN",
    status: "PENDING",
    is_primary: false,
    verification_txt_name: txtName,
    verification_txt_value: txtValue,
    failure_reason: null,
    created_at: new Date("2026-10-30T00:00:00Z"),
    ...overrides,
  };
}

/** Answers each statement by its SQL and records the writes. */
function fakeTx(answers: { tenantState?: string | null; taken?: boolean; domain?: object | null }) {
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  const tx = {
    $queryRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes("FROM tenants")) {
        return Promise.resolve(answers.tenantState ? [{ state: answers.tenantState }] : []);
      }
      if (sql.includes("WHERE hostname =")) {
        return Promise.resolve(answers.taken ? [{ id: "other" }] : []);
      }
      if (/^\s*(INSERT|UPDATE)/.test(sql)) {
        writes.push({ sql, values });
        if (sql.includes("INSERT")) {
          return Promise.resolve([
            domainRow({
              hostname: values[1],
              verification_txt_name: values[2],
              verification_txt_value: values[3],
            }),
          ]);
        }
        if (sql.includes("failure_reason =")) {
          return Promise.resolve([domainRow({ status: values[0], failure_reason: values[1] })]);
        }
        return Promise.resolve([domainRow({ status: "ACTIVE", is_primary: true })]);
      }
      return Promise.resolve(answers.domain ? [answers.domain] : []);
    }),
  };
  return { tx: tx as unknown as PlatformTx, writes };
}

async function statusOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (error) {
    return `${String((error as { status?: number }).status)} ${(error as Error).message}`;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeCustomHostname", () => {
  it.each([
    ["Academy.Acme-Learning.Example.com", "academy.acme-learning.example.com"],
    ["academy.acme.co.uk.", "academy.acme.co.uk"],
  ])("accepts %s", (raw, expected) => {
    expect(normalizeCustomHostname(raw)).toBe(expected);
  });

  it.each([
    "localhost",
    "acme",
    "acme.localhost",
    "acme.localhost.test",
    "acme.internal",
    "192.168.1.10",
    "-acme.com",
    "acme..com",
    "acme.com/path",
    "https://acme.com",
  ])("refuses %s", (raw) => {
    expect(() => normalizeCustomHostname(raw)).toThrowError(/public domain name/);
  });
});

describe("addPlatformTenantCustomDomain", () => {
  const options = { reservedHostnames: ["platform.acme-learning.example.com"] };

  it("adds it pending, with a fresh TXT record to create", async () => {
    const { tx, writes } = fakeTx({ tenantState: "ACTIVE" });
    const { data } = await addPlatformTenantCustomDomain(
      tx,
      ctx,
      tenantId,
      { hostname: "Academy.Acme-Learning.Example.com" },
      options,
    );
    expect(data.status).toBe("PENDING");
    expect(data.hostname).toBe("academy.acme-learning.example.com");
    expect(data.verification?.txtName).toBe("_atlas-verify.academy.acme-learning.example.com");
    expect(data.verification?.txtValue).toMatch(/^atlas=[0-9a-f]{48}$/);
    expect(writes[0]?.sql).toContain("'PENDING'");
    expect(mocks.auditWrite).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({ action: "tenant.domain.created", reason: ctx.reason }),
    );
  });

  it.each([
    ["the platform's own host", { tenantState: "ACTIVE" }, "platform.acme-learning.example.com"],
    ["a name another domain uses", { tenantState: "ACTIVE", taken: true }, "a.example.com"],
    ["an archived tenant", { tenantState: "ARCHIVED" }, "a.example.com"],
  ])("refuses %s, writing nothing", async (_case, answers, hostname) => {
    const { tx, writes } = fakeTx(answers);
    expect(
      await statusOf(addPlatformTenantCustomDomain(tx, ctx, tenantId, { hostname }, options)),
    ).toMatch(/^409 /);
    expect(writes).toHaveLength(0);
  });
});

describe("verifyPlatformTenantDomain", () => {
  it("activates the domain when its TXT record matches, even split into chunks", async () => {
    const { tx, writes } = fakeTx({ domain: domainRow() });
    const resolveTxt = vi.fn().mockResolvedValue([["v=spf1 -all"], ["atlas=0123", "456789abcdef"]]);
    const { data } = await verifyPlatformTenantDomain(tx, ctx, tenantId, domainId, resolveTxt);
    expect(resolveTxt).toHaveBeenCalledWith(txtName);
    expect(data.status).toBe("ACTIVE");
    expect(data.verification).toBeNull();
    expect(writes[0]?.values.slice(0, 2)).toEqual(["ACTIVE", null]);
    expect(mocks.auditWrite).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({ action: "tenant.domain.verified" }),
    );
  });

  it.each([
    [
      "no record",
      () => Promise.reject(Object.assign(new Error("x"), { code: "ENOTFOUND" })),
      "No TXT record found yet.",
    ],
    [
      "a different value",
      () => Promise.resolve([["atlas=wrong"]]),
      "A TXT record exists, but its value does not match.",
    ],
    [
      "a DNS failure",
      () => Promise.reject(Object.assign(new Error("x"), { code: "ETIMEOUT" })),
      "The DNS lookup failed (ETIMEOUT). Try again shortly.",
    ],
  ])("records why when there is %s", async (_case, resolve, reason) => {
    const { tx, writes } = fakeTx({ domain: domainRow() });
    const { data } = await verifyPlatformTenantDomain(tx, ctx, tenantId, domainId, resolve);
    expect(writes[0]?.values.slice(0, 2)).toEqual(["FAILED", reason]);
    expect(data.status).toBe("FAILED");
    expect(data.failureReason).toBe(reason);
    expect(mocks.auditWrite).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({ action: "tenant.domain.verification_failed" }),
    );
  });

  it.each([
    ["a platform subdomain", { type: "ATLAS_SUBDOMAIN", status: "ACTIVE" }],
    ["an already active domain", { status: "ACTIVE" }],
    ["a disabled domain", { status: "DISABLED" }],
  ])("refuses %s without looking it up", async (_case, overrides) => {
    const { tx, writes } = fakeTx({ domain: domainRow(overrides) });
    const resolveTxt = vi.fn();
    expect(
      await statusOf(verifyPlatformTenantDomain(tx, ctx, tenantId, domainId, resolveTxt)),
    ).toMatch(/^409 /);
    expect(resolveTxt).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("answers 404 for another tenant's or a missing domain", async () => {
    const { tx } = fakeTx({ domain: null });
    expect(
      await statusOf(verifyPlatformTenantDomain(tx, ctx, tenantId, domainId, vi.fn())),
    ).toMatch(/^404 /);
  });
});

describe("setPlatformTenantPrimaryDomain", () => {
  it("moves the primary flag to an active domain", async () => {
    const { tx, writes } = fakeTx({ domain: domainRow({ status: "ACTIVE" }) });
    const { data } = await setPlatformTenantPrimaryDomain(tx, ctx, tenantId, domainId);
    expect(data.isPrimary).toBe(true);
    expect(writes[0]?.sql).toContain("is_primary = false");
    expect(writes[1]?.sql).toContain("is_primary = true");
  });

  it("refuses a domain that is not active", async () => {
    const { tx, writes } = fakeTx({ domain: domainRow({ status: "PENDING" }) });
    expect(await statusOf(setPlatformTenantPrimaryDomain(tx, ctx, tenantId, domainId))).toMatch(
      /^409 /,
    );
    expect(writes).toHaveLength(0);
  });
});
