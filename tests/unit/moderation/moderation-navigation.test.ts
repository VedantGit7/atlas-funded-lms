import { describe, expect, it } from "vitest";
import {
  MODERATION_PRIMARY_NAV,
  filterModerationNavigation,
} from "../../../frontend/apps/web/src/features/moderation/moderation-navigation";

describe("moderation navigation projection", () => {
  it("hides appeals when appeal review is unavailable", () => {
    const items = filterModerationNavigation(MODERATION_PRIMARY_NAV, {
      canAccessModerationQueue: true,
      canAccessAppealsReview: false,
      canAccessSpaceManage: true,
      canAccessWorkflowReview: false,
    });

    expect(items.some((item) => item.href === "/moderate/appeals")).toBe(false);
    expect(items.some((item) => item.href === "/moderate/cases")).toBe(true);
  });

  it("hides review link without workflow capability", () => {
    const items = filterModerationNavigation(MODERATION_PRIMARY_NAV, {
      canAccessModerationQueue: true,
      canAccessAppealsReview: true,
      canAccessSpaceManage: true,
      canAccessWorkflowReview: false,
    });

    expect(items.some((item) => item.href === "/admin/review")).toBe(false);
  });

  it("shows review link only with workflow capability", () => {
    const items = filterModerationNavigation(MODERATION_PRIMARY_NAV, {
      canAccessModerationQueue: true,
      canAccessAppealsReview: true,
      canAccessSpaceManage: true,
      canAccessWorkflowReview: true,
    });

    expect(items.some((item) => item.href === "/admin/review")).toBe(true);
  });

  it("does not branch on role names", () => {
    const source = MODERATION_PRIMARY_NAV.toString();
    expect(source).not.toMatch(/role\.name|membership\.role/);
  });

  it("does not expose general admin or platform navigation", () => {
    const hrefs = MODERATION_PRIMARY_NAV.map((item) => item.href);
    expect(hrefs.join("\n")).not.toMatch(/\/platform|\/moderate\/audit/);
    expect(hrefs.filter((href) => href.startsWith("/admin") && href !== "/admin/review")).toEqual(
      [],
    );
  });
});
