import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pageDocumentTitle,
  pageLabelForPath,
} from "../../../frontend/apps/web/src/lib/branding/page-title";
import { academyAreaLabel } from "../../../frontend/apps/web/src/lib/branding/document-title";
import {
  notInAcademyMessage,
  notOnPlanMessage,
} from "../../../frontend/apps/web/src/lib/plan-messages";
import {
  courseResult,
  matchAdminPages,
  memberResult,
} from "../../../frontend/apps/web/src/features/admin/search/admin-header-search";
import { whatsappDevToolsAvailable } from "../../../backend/apps/api/src/server/whatsapp/whatsapp.service";

/** QA S1.8: developer leftovers (review 1 M16, m1, m2, m37; review 2 H1, H7, H8, H13). */

describe("tab titles name the page (m1)", () => {
  it("uses the menu entry the address falls under", () => {
    expect(pageDocumentTitle("/admin/members", "Northwind LMS")).toBe("Members · Northwind LMS");
    expect(pageDocumentTitle("/admin/members/abc", "Northwind LMS")).toBe(
      "Members · Northwind LMS",
    );
    expect(pageLabelForPath("/admin")).toBe("Admin");
    expect(pageLabelForPath("/studio/courses/abc/editor")).toBe("Courses");
    expect(pageLabelForPath("/")).toBe("Home");
    expect(pageLabelForPath("/courses/abc")).toBe("Courses");
  });

  it("falls back to the academy title alone, never repeating it", () => {
    expect(pageDocumentTitle("/nowhere-in-the-menu", "Northwind LMS")).toBe("Northwind LMS");
  });
});

describe("footers (m2)", () => {
  it("doesn't repeat Academy", () => {
    expect(academyAreaLabel("Northwind Academy", "Admin")).toBe("Northwind Academy Admin");
    expect(academyAreaLabel("Northwind", "Studio")).toBe("Northwind Academy Studio");
    // An academy with no name of its own is just "Academy".
    expect(academyAreaLabel("Academy", "Studio")).toBe("Academy Studio");
  });
});

describe("plan wording agrees with the feature name", () => {
  it("uses aren't for plural names", () => {
    expect(notInAcademyMessage("Leaderboards", { plural: true })).toBe(
      "Leaderboards aren't available in this academy.",
    );
    expect(notOnPlanMessage("Custom domains", { plural: true })).toBe(
      "Custom domains aren't included in your academy's plan. The academy owner can add them.",
    );
    expect(notInAcademyMessage("Community")).toBe("Community isn't available in this academy.");
  });
});

describe("admin header search (H13)", () => {
  const pages = [
    { href: "/admin/members", title: "Members" },
    { href: "/admin/roles", title: "Roles" },
    {
      href: "/admin/settings/domains",
      title: "Custom domains",
      description: "Connect your own web address",
      keywords: ["dns"],
    },
    { href: "/admin/members", title: "Members (duplicate)" },
  ];

  it("finds pages by name, description or keyword, best match first", () => {
    expect(matchAdminPages("mem", pages).map((r) => r.href)).toEqual(["/admin/members"]);
    expect(matchAdminPages("dns", pages).map((r) => r.title)).toEqual(["Custom domains"]);
    expect(matchAdminPages("web address", pages).map((r) => r.title)).toEqual(["Custom domains"]);
    expect(matchAdminPages("m", pages)).toEqual([]);
  });

  it("links members and courses to their pages", () => {
    expect(
      memberResult({
        id: "m1",
        accountEmail: "asha@example.test",
        profile: { displayName: "Asha" },
      }),
    ).toEqual({
      id: "member:m1",
      group: "Members",
      title: "Asha",
      detail: "asha@example.test",
      href: "/admin/members/m1",
    });
    expect(courseResult({ id: "c1", title: "Price action", status: "PUBLISHED" })).toMatchObject({
      href: "/studio/courses/c1",
      detail: "Live",
    });
  });
});

describe("WhatsApp development tools (H8)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exist only outside staging and production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "development");
    expect(whatsappDevToolsAvailable()).toBe(true);

    vi.stubEnv("APP_ENV", "staging");
    expect(whatsappDevToolsAvailable()).toBe(false);

    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    expect(whatsappDevToolsAvailable()).toBe(false);
  });
});
