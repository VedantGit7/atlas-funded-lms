import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmtpEmailProvider } from "../../../backend/apps/api/src/server/notifications/notification.email-provider";

const smtp = { sendMail: vi.fn(), close: vi.fn(), createTransport: vi.fn() };

const input = {
  tenantId: null,
  to: "a@example.test",
  subject: "s",
  body: "b",
  requestId: "r",
  idempotencyKey: "original-event:destination",
};
// The fake transport is injected rather than mocked by module path: nodemailer 10 resolves to
// separate ESM and CommonJS builds, so a path-based mock no longer reaches the provider's import.
const provider = () =>
  new SmtpEmailProvider(
    { SMTP_HOST: "smtp.test", NOTIFICATION_EMAIL_FROM: "sender@example.test" },
    smtp.createTransport as never,
  );

beforeEach(() => {
  vi.clearAllMocks();
  smtp.sendMail.mockReset().mockResolvedValue({ accepted: [input.to] });
  smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail, close: smtp.close });
});

describe("SMTP delivery outcomes", () => {
  it("uses stable correlation identity and bounded SMTP deadlines", async () => {
    const transport = provider();
    await transport.send(input);
    await transport.send({ ...input, requestId: "replay-request" });
    expect(smtp.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      }),
    );
    const first = smtp.sendMail.mock.calls[0]?.[0];
    expect(first.messageId).toMatch(/^<atlas-[a-f0-9]+@outbox.local>$/);
    expect(smtp.sendMail.mock.calls[1]?.[0].messageId).toBe(first.messageId);
    expect(transport.supportsIdempotency).toBe(false);
  });

  it.each([
    [451, "retryable"],
    [550, "permanent"],
  ])("classifies explicit %s rejection", async (responseCode, kind) => {
    smtp.sendMail.mockRejectedValue({
      responseCode,
      command: "DATA",
      message: "private SMTP text",
    });
    await expect(provider().send(input)).rejects.toMatchObject({
      kind,
      code: `SMTP_${responseCode}`,
    });
  });

  it("holds unknown acceptance for reconciliation without leaking transport messages", async () => {
    smtp.sendMail.mockRejectedValue(new Error("socket lost; private recipient"));
    await expect(provider().send(input)).rejects.toMatchObject({
      kind: "reconciliation_required",
      code: "SMTP_ACCEPTANCE_UNKNOWN",
    });
  });

  it("does not acknowledge a transport result without confirmed recipients", async () => {
    smtp.sendMail.mockResolvedValue({ accepted: [] });
    await expect(provider().send(input)).rejects.toMatchObject({
      kind: "reconciliation_required",
      code: "SMTP_ACCEPTANCE_UNKNOWN",
    });
  });

  it("bounds a stuck send and closes the transport without retrying", async () => {
    vi.useFakeTimers();
    try {
      smtp.sendMail.mockImplementation(() => new Promise(() => {}));
      const result = provider().send(input);
      const assertion = expect(result).rejects.toMatchObject({
        kind: "reconciliation_required",
        code: "SMTP_DEADLINE_EXCEEDED",
      });
      await vi.advanceTimersByTimeAsync(45_000);
      await assertion;
      expect(smtp.close).toHaveBeenCalledOnce();
      expect(smtp.sendMail).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
