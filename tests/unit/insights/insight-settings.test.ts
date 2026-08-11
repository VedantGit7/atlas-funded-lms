import { describe, expect, it } from "vitest";
import {
  applyInsightSettingsMutation,
  defaultInsightSettings,
  insightDataClass,
  numberFormatSample,
  parseInsightSettings,
  settingsEqual,
} from "../../../backend/apps/api/src/server/insights/insights-settings";
import { insightSettingsResponseSchema } from "../../../backend/apps/api/src/server/insights/insights.schemas";

describe("insight settings", () => {
  it("parses persisted JSON with safe defaults", () => {
    const parsed = parseInsightSettings({
      defaultSection: "sales-insight",
      defaultPeriod: "ytd",
      weekStartsOn: "sunday",
      numberFormat: "european",
      autoRefresh: true,
      refreshIntervalMinutes: 30,
      showLastUpdated: false,
      cacheMinutes: 15,
      restrictedSlugs: ["messenger-insight", "not-a-section"],
      activity: [
        { at: "2026-08-11T10:00:00.000Z", action: "Insights defaults updated", actorLabel: "Ada" },
      ],
    });
    expect(parsed.defaultSection).toBe("sales-insight");
    expect(parsed.defaultPeriod).toBe("ytd");
    expect(parsed.restrictedSlugs).toEqual(["messenger-insight"]);
    expect(parsed.activity).toHaveLength(1);
    expect(numberFormatSample(parsed.numberFormat)).toBe("1.234.567,89");
  });

  it("appends activity when defaults change and no-ops when unchanged", () => {
    const base = defaultInsightSettings();
    const same = applyInsightSettingsMutation(base, {
      type: "save",
      actorLabel: "Ada",
      patch: {
        defaultSection: base.defaultSection,
        defaultPeriod: base.defaultPeriod,
        weekStartsOn: base.weekStartsOn,
        numberFormat: base.numberFormat,
        autoRefresh: base.autoRefresh,
        refreshIntervalMinutes: base.refreshIntervalMinutes,
        showLastUpdated: base.showLastUpdated,
        cacheMinutes: base.cacheMinutes,
      },
    });
    expect(same.activity).toHaveLength(0);
    const next = applyInsightSettingsMutation(base, {
      type: "save",
      actorLabel: "Ada",
      patch: {
        defaultSection: "school-vitals",
        defaultPeriod: "12m",
        weekStartsOn: "sunday",
        numberFormat: "european",
        autoRefresh: true,
        refreshIntervalMinutes: 60,
        showLastUpdated: false,
        cacheMinutes: 5,
      },
    });
    expect(next.defaultSection).toBe("school-vitals");
    expect(next.activity[0]?.action).toBe("Insights defaults updated");
    expect(settingsEqual(base, next)).toBe(false);
  });

  it("restricts a section and refuses to hide the last remaining one", () => {
    let settings = defaultInsightSettings();
    settings = applyInsightSettingsMutation(settings, {
      type: "restrict",
      slug: "sales-insight",
      actorLabel: "Ada",
    });
    expect(settings.restrictedSlugs).toContain("sales-insight");
    expect(insightDataClass("sales-insight")).toBe("financial");
    const allButOne = [
      "dashboard",
      "school-vitals",
      "live-dashboard",
      "marketing-insight",
      "messenger-insight",
    ];
    for (const slug of allButOne.slice(1)) {
      settings = applyInsightSettingsMutation(settings, {
        type: "restrict",
        slug,
        actorLabel: "Ada",
      });
    }
    const blocked = applyInsightSettingsMutation(settings, {
      type: "restrict",
      slug: allButOne[0] ?? "dashboard",
      actorLabel: "Ada",
    });
    expect(blocked.restrictedSlugs).toEqual(settings.restrictedSlugs);
  });

  it("accepts the settings board schema", () => {
    const result = insightSettingsResponseSchema.safeParse({
      data: {
        slug: "dashboard",
        title: "Dashboard",
        generatedAt: "2026-08-11T00:00:00.000Z",
        currency: "INR",
        numberFormatSample: "1,234,567.89",
        settings: {
          defaultSection: "dashboard",
          defaultPeriod: "30d",
          weekStartsOn: "monday",
          numberFormat: "international",
          autoRefresh: false,
          refreshIntervalMinutes: 15,
          showLastUpdated: true,
          cacheMinutes: 30,
          restrictedSlugs: [],
        },
        sections: [{ slug: "dashboard", title: "Dashboard" }],
        roles: [{ key: "admin", name: "Admin", memberCount: 2 }],
        access: [
          {
            slug: "dashboard",
            title: "Dashboard",
            href: "/admin/insights/dashboard",
            restricted: false,
            visibleTo: [{ key: "admin", name: "Admin", memberCount: 2 }],
            dataClass: "personal",
            layoutSource: "factory",
          },
        ],
        activity: [],
      },
    });
    expect(result.success).toBe(true);
  });
});
