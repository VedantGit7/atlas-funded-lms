import { describe, expect, it } from "vitest";
import {
  buildDefaultNotificationPreferences,
  mergeNotificationPreferences,
  validateNotificationPreferenceInput,
} from "@atlas/membership";

describe("notification preferences catalog", () => {
  it("defaults all categories to enabled", () => {
    const defaults = buildDefaultNotificationPreferences();
    expect(defaults["certificate.issued"]).toEqual({ email: true, inApp: true });
    expect(defaults["security.password_changed"]).toEqual({ email: true, inApp: true });
    expect(defaults["security.mfa_disabled"]).toEqual({ email: true, inApp: true });
  });

  it("merges overrides while keeping defaults for unspecified keys", () => {
    const merged = mergeNotificationPreferences({
      "security.password_changed": { email: false, inApp: false },
    });
    expect(merged["security.password_changed"]).toEqual({ email: false, inApp: false });
    expect(merged["certificate.issued"]).toEqual({ email: true, inApp: true });
  });

  it("rejects unknown preference keys", () => {
    const validated = validateNotificationPreferenceInput({
      "security.email_changed": { email: false },
      "not.a.real.key": { email: true },
    });
    expect(validated).toEqual({ "security.email_changed": { email: false } });
  });
});
