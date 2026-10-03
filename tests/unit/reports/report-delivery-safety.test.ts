import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";
import type { ReportDeliveryEffect } from "@atlas/domain/reports/report-delivery-effects.repository";
import type { ReportDeliveryEmailSender } from "@atlas/domain/reports/reports-delivery";

const state = vi.hoisted(() => ({
  active: false,
  effects: [] as Array<ReportDeliveryEffect & { status: string; errorKind?: string | null }>,
  sends: [] as Array<{ headers: Record<string, string>; signal: AbortSignal; body: string }>,
  storage: [] as Array<{ key: string; body: Uint8Array }>,
  failReceipt: false,
  failStorage: false,
  webhookStatus: 200,
  expiresAt: new Date("2100-01-01"),
  signedTTLs: [] as number[],
  artifact: null as unknown,
}));
vi.mock("@atlas/domain/reports/reports.service", () => ({
  mapRunBaseDto: (run: unknown) => run,
  getReportRun: async () => ({
    data: {
      status: "SUCCEEDED",
      download: { url: "https://example.com/download", expiresAt: "2030-01-01" },
      params: { deliveryEmails: ["a@example.com", "b@example.com"] },
      format: "csv",
      definitionTitle: "Sales",
      id: "run",
    },
  }),
  listReportSchedules: async () => ({ data: { items: [] } }),
}));
vi.mock("@atlas/domain/reports/reports.repository", () => ({
  reportsRepository: {
    findReportRunById: vi.fn(async () => ({
      id: "run",
      tenant_id: "tenant",
      status: "SUCCEEDED",
      r2_object_key: "tenants/tenant/export.csv",
      expires_at: state.expiresAt,
      artifact_json: state.artifact,
      params: {
        deliveryEmails: ["a@example.com", "b@example.com"],
        webhookUrl: "https://example.com/report",
      },
      format: "csv",
      definitionTitle: "Sales",
      definitionKey: "sales",
      rowCount: 3,
    })),
    listSchedules: vi.fn(async () => []),
  },
}));
vi.mock("@atlas/domain/reports/destinations-roster.repository", () => ({
  destinationsRosterRepository: { getById: vi.fn(), update: vi.fn() },
  pushHealthDay: vi.fn(),
}));
vi.mock("@atlas/storage", () => ({
  assertTenantKeyPrefix: vi.fn(),
  parseStorageEnv: () => ({ R2_BUCKET_NAME: "test", STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS: 600 }),
  getStorageProvider: () => ({
    createSignedDownloadUrl: async (input: { expiresInSeconds: number }) => {
      expect(state.active).toBe(false);
      state.signedTTLs.push(input.expiresInSeconds);
      return { url: "https://example.com/download", expiresAt: new Date("2030-01-01") };
    },
    getObjectBody: async () => {
      expect(state.active).toBe(false);
      return Buffer.from("report");
    },
    putObject: async (input: { key: string; body: Uint8Array }) => {
      expect(state.active).toBe(false);
      state.storage.push(input);
      if (state.failStorage) {
        state.failStorage = false;
        throw new Error("response lost");
      }
    },
  }),
}));
vi.mock("@atlas/security/safe-outbound-fetch", () => ({
  safeOutboundFetch: vi.fn(async (_url, input) => {
    expect(state.active).toBe(false);
    state.sends.push(input);
    return { ok: state.webhookStatus < 300, status: state.webhookStatus };
  }),
}));
vi.mock("@atlas/domain/reports/report-delivery-effects.repository", () => ({
  reportDeliveryEffectsRepository: {
    list: async () => state.effects,
    freeze: async (_tx: unknown, _run: string, effects: ReportDeliveryEffect[]) => {
      if (!state.effects.length) state.effects = effects.map((e) => ({ ...e, status: "pending" }));
      return state.effects;
    },
    claim: async (_tx: unknown, key: string) => {
      const effect = state.effects.find((e) => e.effectKey === key);
      if (!effect) throw new Error("missing test effect");
      if (effect.status === "succeeded") return { status: "succeeded" };
      if (effect.status === "reconciliation_required") return { status: "reconciliation_required" };
      if (effect.status === "failed" && effect.errorKind === "permanent")
        return { status: "permanent" };
      if (effect.status === "processing" && !effect.retryOnCrash)
        return { status: "reconciliation_required" };
      effect.status = "processing";
      return { status: "claimed", effect, leaseToken: "lease" };
    },
    finish: async (
      _tx: unknown,
      key: string,
      _lease: string,
      status: string,
      errorKind: string | null,
    ) => {
      if (state.failReceipt) {
        state.failReceipt = false;
        throw new Error("receipt commit failed");
      }
      const effect = state.effects.find((e) => e.effectKey === key);
      if (!effect) throw new Error("missing test effect");
      effect.status = status;
      effect.errorKind = errorKind;
      return true;
    },
  },
}));
import { deliverSucceededReportRun } from "@atlas/domain/reports/reports-delivery";
const withTx = async <T>(fn: (tx: TenantTx) => Promise<T>): Promise<T> => {
  expect(state.active).toBe(false);
  state.active = true;
  try {
    return await fn({} as TenantTx);
  } finally {
    state.active = false;
  }
};
const ctx = { tenantId: "tenant", actorMembershipId: "owner", requestId: "req" };
describe("report delivery safety", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  beforeEach(() => {
    state.active = false;
    state.effects = [];
    state.sends = [];
    state.storage = [];
    state.failReceipt = false;
    state.failStorage = false;
    state.webhookStatus = 200;
    state.expiresAt = new Date("2100-01-01");
    state.signedTTLs = [];
    state.artifact = null;
  });
  it("does not sign a managed artifact against a changed storage identity", async () => {
    state.artifact = { provider: "r2", bucket: "other" };
    await expect(
      deliverSucceededReportRun(withTx, ctx, {
        reportRunId: "run",
        sendEmail: async () => undefined,
        resolveMembershipEmail: async () => null,
      }),
    ).rejects.toThrow();
    expect(state.signedTTLs).toEqual([]);
  });
  it("does not issue links or deliveries for an expired artifact", async () => {
    state.expiresAt = new Date(0);
    const email = vi.fn(async () => undefined);
    await expect(
      deliverSucceededReportRun(withTx, ctx, {
        reportRunId: "run",
        sendEmail: email,
        resolveMembershipEmail: async () => null,
      }),
    ).rejects.toThrow();
    expect(email).not.toHaveBeenCalled();
    expect(state.signedTTLs).toEqual([]);
  });
  it("caps newly issued delivery links at remaining artifact retention", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    state.expiresAt = new Date("2026-09-01T00:00:30Z");
    await deliverSucceededReportRun(withTx, ctx, {
      reportRunId: "run",
      sendEmail: async () => undefined,
      resolveMembershipEmail: async () => null,
    });
    expect(state.signedTTLs).toEqual([30]);
  });
  it("commits recipient progress and retries only unfinished recipients outside transactions", async () => {
    const email = vi.fn(async (input: Parameters<ReportDeliveryEmailSender>[0]) => {
      expect(state.active).toBe(false);
      if (input.to === "b@example.com" && email.mock.calls.length === 2) {
        const error = new Error("busy") as Error & { kind: string; code: string };
        error.kind = "retryable";
        error.code = "SMTP_BUSY";
        throw error;
      }
    });
    const args = { reportRunId: "run", sendEmail: email, resolveMembershipEmail: async () => null };
    await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toThrow();
    expect(state.effects[0]?.status).toBe("succeeded");
    await deliverSucceededReportRun(withTx, ctx, args);
    expect(email.mock.calls.map(([i]) => i.to)).toEqual([
      "a@example.com",
      "b@example.com",
      "b@example.com",
    ]);
    expect(email.mock.calls[1]?.[0]).toEqual(email.mock.calls[2]?.[0]);
    expect(state.sends[0]?.headers["idempotency-key"]).toBeTruthy();
    expect(state.sends[0]?.signal).toBeInstanceOf(AbortSignal);
  });
  it("holds ambiguous SMTP delivery for reconciliation without sending again", async () => {
    const email = vi.fn(async (input: Parameters<ReportDeliveryEmailSender>[0]) => {
      if (input.to === "a@example.com") throw new Error("connection lost after DATA");
    });
    const args = { reportRunId: "run", sendEmail: email, resolveMembershipEmail: async () => null };
    await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    expect(email).toHaveBeenCalledTimes(2);
  });
  it("does not repeat an accepted SMTP send if committing its receipt fails", async () => {
    const email = vi.fn(async () => undefined);
    const args = { reportRunId: "run", sendEmail: email, resolveMembershipEmail: async () => null };
    state.failReceipt = true;
    await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    expect(email).toHaveBeenCalledTimes(2);
  });
  it("retries webhook with identical bytes and skips successful emails", async () => {
    const email = vi.fn(async () => undefined);
    const args = { reportRunId: "run", sendEmail: email, resolveMembershipEmail: async () => null };
    state.webhookStatus = 429;
    await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
      kind: "retryable",
    });
    state.webhookStatus = 200;
    await deliverSucceededReportRun(withTx, { ...ctx, requestId: "replay" }, args);
    expect(email).toHaveBeenCalledTimes(2);
    expect(state.sends[0]?.body).toBe(state.sends[1]?.body);
    expect(state.sends[0]?.headers).toEqual(state.sends[1]?.headers);
  });
  it("holds an uncertain webhook server error because receivers may ignore the idempotency header", async () => {
    const args = {
      reportRunId: "run",
      sendEmail: vi.fn(async () => undefined),
      resolveMembershipEmail: async () => null,
    };
    state.webhookStatus = 503;
    await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    expect(state.sends).toHaveLength(1);
  });
  it.each(["email", "webhook"] as const)(
    "stops delayed %s delivery after link expiry while retaining successful receipts",
    async (kind) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2029-12-31T23:59:00Z"));
      const email = vi.fn(async (input: Parameters<ReportDeliveryEmailSender>[0]) => {
        if (kind === "email" && input.to === "b@example.com") {
          const error = new Error("busy") as Error & { kind: string; code: string };
          error.kind = "retryable";
          error.code = "SMTP_BUSY";
          throw error;
        }
      });
      const args = {
        reportRunId: "run",
        sendEmail: email,
        resolveMembershipEmail: async () => null,
      };
      state.webhookStatus = 429;
      await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
        kind: "retryable",
      });
      const frozenRequests = structuredClone(state.effects.map((effect) => effect.request));
      const successes = state.effects
        .filter((effect) => effect.status === "succeeded")
        .map((effect) => effect.effectKey);
      const emailCalls = email.mock.calls.length;
      const webhookCalls = state.sends.length;
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
      state.webhookStatus = 200;
      await expect(
        deliverSucceededReportRun(withTx, { ...ctx, requestId: "delayed-replay" }, args),
      ).rejects.toMatchObject({
        kind: "permanent",
        code: "REPORT_DELIVERY_LINK_EXPIRED",
      });
      expect(email).toHaveBeenCalledTimes(emailCalls);
      expect(state.sends).toHaveLength(webhookCalls);
      expect(
        state.effects
          .filter((effect) => effect.status === "succeeded")
          .map((effect) => effect.effectKey),
      ).toEqual(successes);
      expect(state.effects.map((effect) => effect.request)).toEqual(frozenRequests);
    },
  );
  it("overwrites the same tenant storage key after an unknown response", async () => {
    state.effects = [
      {
        effectKey: "storage",
        kind: "storage",
        destinationId: null,
        retryOnCrash: true,
        status: "pending",
        request: {
          destination: { id: "destination", config_json: { prefix: "daily" } },
          objectKey: "tenants/tenant/export.csv",
          format: "csv",
          definitionKey: "sales",
          reportRunId: "run",
        },
      },
    ];
    const args = { reportRunId: "run", sendEmail: null, resolveMembershipEmail: async () => null };
    state.failStorage = true;
    await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
      kind: "retryable",
    });
    await deliverSucceededReportRun(withTx, ctx, args);
    expect(state.storage.map((s) => s.key)).toEqual([
      "tenants/tenant/exports/destinations/destination/daily/sales-run.csv",
      "tenants/tenant/exports/destinations/destination/daily/sales-run.csv",
    ]);
    expect(state.storage[0]?.body).toEqual(state.storage[1]?.body);
  });
  it.each(["permanent", "reconciliation_required"] as const)(
    "continues independent fan-out past a %s recipient and skips successful recipients on replay",
    async (kind) => {
      state.effects = ["a", "b", "c"].map((recipient) => ({
        effectKey: recipient,
        kind: "email",
        destinationId: null,
        retryOnCrash: false,
        status: "pending",
        request: {
          to: `${recipient}@example.com`,
          subject: "Export",
          body: "Frozen report",
          requestId: recipient,
          idempotencyKey: recipient,
          expiresAt: "2030-01-01T00:00:00Z",
        },
      }));
      const email = vi.fn(async (input: Parameters<ReportDeliveryEmailSender>[0]) => {
        if (input.to === "b@example.com") {
          const error = new Error("rejected") as Error & { kind: string; code: string };
          error.kind = kind;
          error.code = "PROVIDER_REJECTED";
          throw error;
        }
      });
      const args = {
        reportRunId: "run",
        sendEmail: email,
        resolveMembershipEmail: async () => null,
      };
      await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({ kind });
      expect(email.mock.calls.map(([input]) => input.to)).toEqual([
        "a@example.com",
        "b@example.com",
        "c@example.com",
      ]);
      expect(
        state.effects
          .filter((effect) => effect.status === "succeeded")
          .map((effect) => effect.effectKey),
      ).toEqual(["a", "c"]);
      await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({ kind });
      expect(email).toHaveBeenCalledTimes(3);
    },
  );
  it("keeps mixed terminal and transient fan-out failures retryable", async () => {
    const email = vi.fn(async (input: Parameters<ReportDeliveryEmailSender>[0]) => {
      const error = new Error("rejected") as Error & { kind: string; code: string };
      error.kind = input.to === "a@example.com" ? "retryable" : "permanent";
      error.code = "PROVIDER_REJECTED";
      throw error;
    });
    state.webhookStatus = 503;
    await expect(
      deliverSucceededReportRun(withTx, ctx, {
        reportRunId: "run",
        sendEmail: email,
        resolveMembershipEmail: async () => null,
      }),
    ).rejects.toMatchObject({ kind: "retryable" });
    expect(email).toHaveBeenCalledTimes(2);
    expect(state.sends).toHaveLength(1);
    expect(state.effects.map((effect) => effect.status)).toEqual([
      "failed",
      "failed",
      "reconciliation_required",
    ]);
  });
  it.each(["permanent", "reconciliation_required"] as const)(
    "retries transient recipients beside a %s outcome before surfacing that terminal outcome",
    async (terminalKind) => {
      state.effects = ["a", "b", "c"].map((recipient) => ({
        effectKey: recipient,
        kind: "email",
        destinationId: null,
        retryOnCrash: false,
        status: "pending",
        request: {
          to: `${recipient}@example.com`,
          subject: "Export",
          body: "Frozen report",
          requestId: recipient,
          idempotencyKey: recipient,
          expiresAt: "2030-01-01T00:00:00Z",
        },
      }));
      let transientAttempts = 0;
      const email = vi.fn(async (input: Parameters<ReportDeliveryEmailSender>[0]) => {
        const kind =
          input.to === "a@example.com"
            ? terminalKind
            : input.to === "b@example.com" && ++transientAttempts === 1
              ? "retryable"
              : null;
        if (kind) {
          const error = new Error("provider failure") as Error & { kind: string; code: string };
          error.kind = kind;
          error.code = kind === "retryable" ? "SMTP_450" : "PROVIDER_REJECTED";
          throw error;
        }
      });
      const args = {
        reportRunId: "run",
        sendEmail: email,
        resolveMembershipEmail: async () => null,
      };
      await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
        kind: "retryable",
        code: "SMTP_450",
      });
      await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
        kind: terminalKind,
      });
      expect(email.mock.calls.map(([input]) => input.to)).toEqual([
        "a@example.com",
        "b@example.com",
        "c@example.com",
        "b@example.com",
      ]);
      expect(
        state.effects
          .filter((effect) => effect.status === "succeeded")
          .map((effect) => effect.effectKey),
      ).toEqual(["b", "c"]);
      await expect(deliverSucceededReportRun(withTx, ctx, args)).rejects.toMatchObject({
        kind: terminalKind,
      });
      expect(email).toHaveBeenCalledTimes(4);
    },
  );
});
