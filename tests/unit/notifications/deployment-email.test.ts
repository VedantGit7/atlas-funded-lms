import { afterEach, describe, expect, it } from "vitest";
import {
  getEmailProvider,
  setEmailProviderForTests,
} from "../../../backend/apps/api/src/server/notifications/notification.email-provider";
afterEach(() => setEmailProviderForTests(null));
describe("F05 email deployment guards", () => {
  it("rejects mock email based on NODE_ENV alone", () => {
    expect(() =>
      getEmailProvider({ NODE_ENV: "production", NOTIFICATION_EMAIL_PROVIDER: "mock" }),
    ).toThrow(/smtp/);
  });
  it("validates configuration before returning a cached development provider", () => {
    getEmailProvider({ NODE_ENV: "development", NOTIFICATION_EMAIL_PROVIDER: "mock" });
    expect(() =>
      getEmailProvider({ NODE_ENV: "production", NOTIFICATION_EMAIL_PROVIDER: "mock" }),
    ).toThrow(/smtp/);
  });
});
