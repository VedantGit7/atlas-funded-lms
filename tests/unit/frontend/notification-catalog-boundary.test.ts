import { describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ loads: 0 }));
vi.mock("zod", async (original) => {
  runtime.loads += 1;
  return original();
});

describe("notification display catalog", () => {
  it("loads every category and opt-out default without the validation runtime", async () => {
    const data =
      await import("../../../frontend/packages/contracts/src/membership/notification-preferences.data");
    expect(runtime.loads).toBe(0);
    expect(data.NOTIFICATION_PREFERENCE_CATEGORIES).toHaveLength(9);
    expect(Object.keys(data.NOTIFICATION_CATEGORY_LABELS)).toEqual([
      ...data.NOTIFICATION_PREFERENCE_CATEGORIES,
    ]);
    const defaults = data.buildDefaultNotificationPreferences();
    for (const category of data.NOTIFICATION_PREFERENCE_CATEGORIES) {
      expect(defaults[category]).toEqual({ email: true, inApp: true });
      expect(data.isNotificationCategoryEnabled({}, category)).toBe(true);
      expect(data.isNotificationCategoryEnabled({ [category]: false }, category)).toBe(false);
    }
    expect(
      data.mergeNotificationPreferences({ "certificate.issued": { email: false } })[
        "certificate.issued"
      ],
    ).toEqual({ email: false, inApp: true });
    defaults["certificate.issued"].email = false;
    expect(data.buildDefaultNotificationPreferences()["certificate.issued"].email).toBe(true);
  });

  it("retains the validation exports and rejects unknown categories", async () => {
    const catalog =
      await import("../../../frontend/packages/contracts/src/membership/notification-preferences.catalog");
    for (const category of catalog.NOTIFICATION_PREFERENCE_CATEGORIES) {
      expect(catalog.notificationPreferenceCategorySchema.safeParse(category).success).toBe(true);
    }
    expect(catalog.notificationPreferenceCategorySchema.safeParse("unknown").success).toBe(false);
    expect(
      catalog.validateNotificationPreferenceInput({
        unknown: { email: false },
        "certificate.issued": { inApp: false },
      }),
    ).toEqual({ "certificate.issued": { inApp: false } });
  });
});
