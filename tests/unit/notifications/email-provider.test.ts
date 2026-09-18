import { afterEach, describe, expect, it } from "vitest";
import {
  SmtpEmailProvider,
  getEmailProvider,
  setEmailProviderForTests,
} from "../../../backend/apps/api/src/server/notifications/notification.email-provider";

/**
 * Regression tests for audit finding C7.
 *
 * There was no real email transport at all: the only working provider required
 * NOTIFICATION_EMAIL_PROVIDER=mock and then logged-and-discarded, and no email
 * library was installed anywhere in the monorepo. Production could therefore
 * only ever silently discard mail or throw — so signup verification, password
 * reset and invitations were non-functional.
 */

afterEach(() => {
  setEmailProviderForTests(null);
});

describe("getEmailProvider — fail closed in production", () => {
  it.each(["production", "staging"])("throws when unconfigured and APP_ENV=%s", (appEnv) => {
    expect(() => getEmailProvider({ APP_ENV: appEnv } as NodeJS.ProcessEnv)).toThrow(
      /must be "smtp"/,
    );
  });

  it("refuses the mock provider in production", () => {
    expect(() =>
      getEmailProvider({
        APP_ENV: "production",
        NOTIFICATION_EMAIL_PROVIDER: "mock",
      } as NodeJS.ProcessEnv),
    ).toThrow(/must be "smtp"/);
  });

  it("rejects smtp selected but not configured in production", () => {
    expect(() =>
      getEmailProvider({
        APP_ENV: "production",
        NOTIFICATION_EMAIL_PROVIDER: "smtp",
      } as NodeJS.ProcessEnv),
    ).toThrow(/SMTP_HOST/);
  });

  it("accepts a fully configured smtp provider in production", () => {
    const provider = getEmailProvider({
      APP_ENV: "production",
      NOTIFICATION_EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      NOTIFICATION_EMAIL_FROM: "no-reply@example.com",
    } as NodeJS.ProcessEnv);

    expect(provider.isConfigured()).toBe(true);
  });
});

describe("getEmailProvider — development", () => {
  it("allows the mock provider outside production", () => {
    const provider = getEmailProvider({
      APP_ENV: "development",
      NOTIFICATION_EMAIL_PROVIDER: "mock",
    } as NodeJS.ProcessEnv);

    expect(provider.isConfigured()).toBe(true);
  });

  it("returns an unconfigured provider that throws when nothing is set", async () => {
    const provider = getEmailProvider({} as NodeJS.ProcessEnv);

    expect(provider.isConfigured()).toBe(false);
    await expect(
      provider.send({ to: "a@b.test", subject: "s", body: "b", requestId: "r" }),
    ).rejects.toThrow("EMAIL_PROVIDER_NOT_CONFIGURED");
  });
});

describe("SmtpEmailProvider", () => {
  it("is not configured without SMTP_HOST", () => {
    expect(
      new SmtpEmailProvider({
        NOTIFICATION_EMAIL_FROM: "no-reply@example.com",
      } as NodeJS.ProcessEnv).isConfigured(),
    ).toBe(false);
  });

  it("is not configured without a from address", () => {
    expect(
      new SmtpEmailProvider({ SMTP_HOST: "smtp.example.com" } as NodeJS.ProcessEnv).isConfigured(),
    ).toBe(false);
  });

  it("refuses to send when unconfigured", async () => {
    await expect(
      new SmtpEmailProvider({} as NodeJS.ProcessEnv).send({
        to: "a@b.test",
        subject: "s",
        body: "b",
        requestId: "r",
      }),
    ).rejects.toThrow("EMAIL_PROVIDER_NOT_CONFIGURED");
  });
});
