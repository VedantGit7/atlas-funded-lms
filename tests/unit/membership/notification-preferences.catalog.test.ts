import { describe, expect, it } from "vitest";
import {
  buildDefaultNotificationPreferences,
  mergeNotificationPreferences,
  validateNotificationPreferenceInput,
} from "@atlas/membership";

describe("notification preferences catalog", () => {
  it("defaults all categories to enabled", () => {
    const defaults = buildDefaultNotificationPreferences();
    expect(defaults["certificate.issued"]).toBe(true);
    expect(defaults["security.password_changed"]).toBe(true);
    expect(defaults["security.mfa_disabled"]).toBe(true);
  });

  it("merges overrides while keeping defaults for unspecified keys", () => {
    const merged = mergeNotificationPreferences({
      "security.password_changed": false,
    });
    expect(merged["security.password_changed"]).toBe(false);
    expect(merged["certificate.issued"]).toBe(true);
  });

  it("rejects unknown preference keys", () => {
    const validated = validateNotificationPreferenceInput({
      "security.email_changed": false,
      "not.a.real.key": true,
    });
    expect(validated).toEqual({ "security.email_changed": false });
  });
});
