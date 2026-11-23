// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * QA S1.7 in the web app (review 1 C14, C17, C20, M11, M12, M39, m44; review
 * 2 H3, H5): who gets Studio and the admin area, who can be an instructor,
 * which learners can be archived, and what a plan-gated page says.
 */

const { mockServerGet, mockClientGet } = vi.hoisted(() => ({
  mockServerGet: vi.fn(),
  mockClientGet: vi.fn(),
}));

vi.mock("../../../frontend/apps/web/src/lib/server/tenant-state-gate", () => ({
  runTenantStateGate: () =>
    Promise.resolve({ kind: "ok", tenant: { tenantId: "tenant", requestId: "req_test" } }),
}));
vi.mock("../../../frontend/apps/web/src/lib/server/public-tenant-branding", () => ({
  loadPublicTenantBranding: () => Promise.resolve({ publicName: "Academy" }),
}));
vi.mock("../../../frontend/apps/web/src/lib/server/studio-navigation-projection", () => ({
  loadStudioNavigationProjection: () =>
    Promise.resolve({ items: [], pendingReviewCount: null, pendingGradingCount: null }),
}));
vi.mock("../../../frontend/apps/web/src/lib/server/admin-navigation-projection", () => ({
  loadAdminNavigationProjection: () =>
    Promise.resolve({ items: [], pendingReviewCount: null, mfaEnabled: true }),
}));
vi.mock("../../../frontend/apps/web/src/lib/server-api", async () => {
  const errors = await import("../../../frontend/apps/web/src/lib/api/errors");
  return { serverApi: { get: mockServerGet }, ServerApiError: errors.ServerApiError };
});
vi.mock("../../../frontend/apps/web/src/lib/client-api", async () => {
  const errors = await import("../../../frontend/apps/web/src/lib/api/errors");
  return { clientApi: { get: mockClientGet }, ClientApiError: errors.ClientApiError };
});

const { loadStudioShellContext, STUDIO_NO_ACCESS_MESSAGE } =
  await import("../../../frontend/apps/web/src/lib/server/studio-shell-context");
const { loadAdminShellContext, ADMIN_NO_ACCESS_MESSAGE } =
  await import("../../../frontend/apps/web/src/lib/server/admin-shell-context");
const { loadInstructorMembers } =
  await import("../../../frontend/apps/web/src/features/studio/courses/create-course-add-member-dialog");
const { isStaffMember, learnerCountLabel } =
  await import("../../../frontend/apps/web/src/features/admin/manage/ManageArchiveLearnersPanel");
const { notInAcademyMessage, notOnPlanMessage } =
  await import("../../../frontend/apps/web/src/lib/plan-messages");
const { isAuthorizationDenied, isNotOnPlan } =
  await import("../../../frontend/apps/web/src/features/admin/domain/admin-domain-shared");
const { ClientApiError } = await import("../../../frontend/apps/web/src/lib/api/errors");

function me(overrides: { roleKeys?: string[]; studioAccess?: boolean; mfaEnabled?: boolean }) {
  return {
    data: {
      membership: {
        id: "00000000-0000-4000-8000-000000000001",
        status: "ACTIVE",
        roleKeys: overrides.roleKeys ?? ["learner"],
        studioAccess: overrides.studioAccess ?? false,
      },
      profile: { displayName: "Asha", avatarUrl: null },
      identity: { email: "asha@example.test", mfaEnabled: overrides.mfaEnabled ?? false },
    },
  };
}

beforeEach(() => {
  mockServerGet.mockReset();
  mockClientGet.mockReset();
});

describe("Studio and admin gates", () => {
  it("refuses Studio to a learner with the shared no-access message (C20, m44)", async () => {
    mockServerGet.mockResolvedValue(me({ studioAccess: false }));
    const context = await loadStudioShellContext();
    expect(context).toMatchObject({
      kind: "membership_blocked",
      reason: "forbidden",
      message: STUDIO_NO_ACCESS_MESSAGE,
    });
  });

  it("opens Studio to a member with authoring access", async () => {
    mockServerGet.mockResolvedValue(me({ roleKeys: ["instructor"], studioAccess: true }));
    expect((await loadStudioShellContext()).kind).toBe("ready");
  });

  it("tells a learner the admin area isn't theirs, without an MFA hint (M39)", async () => {
    mockServerGet.mockResolvedValue(me({ roleKeys: ["learner"], mfaEnabled: false }));
    const context = await loadAdminShellContext();
    expect(context).toMatchObject({ kind: "membership_blocked", message: ADMIN_NO_ACCESS_MESSAGE });
    expect(ADMIN_NO_ACCESS_MESSAGE).not.toMatch(/multi-factor|MFA/i);
  });

  it("still asks an admin without MFA to set it up", async () => {
    mockServerGet.mockResolvedValue(me({ roleKeys: ["admin"], mfaEnabled: false }));
    expect((await loadAdminShellContext()).kind).toBe("session_assurance_blocked");
  });
});

describe("instructor picker (C17, H3)", () => {
  function members(items: Array<{ id: string; name: string }>) {
    return {
      data: {
        items: items.map((item) => ({
          id: item.id,
          status: "ACTIVE",
          accountEmail: `${item.name.toLowerCase()}@example.test`,
          invitedEmail: null,
          profile: { displayName: item.name, avatarUrl: null },
          roles: [],
        })),
        pageInfo: { nextCursor: null, hasNextPage: false },
        totalCount: items.length,
      },
    };
  }

  it("lists active staff only, with the current member first", async () => {
    mockClientGet.mockImplementation((url: string) => {
      if (url === "/api/v1/me") return Promise.resolve(me({ roleKeys: ["admin"] }));
      const role = new URL(url, "http://x").searchParams.get("role");
      if (role === "owner") return Promise.resolve(members([{ id: "o", name: "Owner" }]));
      if (role === "admin")
        return Promise.resolve(
          members([
            { id: "00000000-0000-4000-8000-000000000001", name: "Asha" },
            { id: "b", name: "Bea" },
          ]),
        );
      return Promise.resolve(members([{ id: "c", name: "Chen" }]));
    });

    const list = await loadInstructorMembers();
    expect(list.map((member) => member.displayName)).toEqual(["Asha", "Bea", "Chen", "Owner"]);
    const memberUrls = mockClientGet.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.startsWith("/api/v1/members"));
    expect(memberUrls).toHaveLength(3);
    for (const url of memberUrls) expect(url).toMatch(/status=ACTIVE/);
    expect(memberUrls.some((url) => /role=learner/.test(url))).toBe(false);
  });

  it("falls back to just the current member when people can't be listed", async () => {
    mockClientGet.mockImplementation((url: string) =>
      url === "/api/v1/me"
        ? Promise.resolve(me({ roleKeys: ["instructor"] }))
        : Promise.reject(new ClientApiError("PERMISSION_DENIED", 403, "req", "No")),
    );
    const list = await loadInstructorMembers();
    expect(list).toHaveLength(1);
    expect(list[0]?.displayName).toBe("Asha");
  });
});

describe("archive learners (M12, H5)", () => {
  it("leaves owners and admins out", () => {
    const row = (keys: string[]) =>
      ({ roles: keys.map((key) => ({ id: key, key, name: key, isSystem: true })) }) as never;
    expect(isStaffMember(row(["owner"]))).toBe(true);
    expect(isStaffMember(row(["admin", "learner"]))).toBe(true);
    expect(isStaffMember(row(["learner"]))).toBe(false);
  });

  it("shows the real total, not the page size", () => {
    expect(learnerCountLabel(50, 506)).toBe("Showing 50 of 506 learners");
    expect(learnerCountLabel(12, 12)).toBe("12 learners");
    expect(learnerCountLabel(1, null)).toBe("1 learner");
  });
});

describe("plan messages (C14)", () => {
  it("says it's the plan for staff, and not available for learners", () => {
    expect(notOnPlanMessage("Learner support")).toBe(
      "Learner support isn't included in your academy's plan. The academy owner can add it.",
    );
    expect(notInAcademyMessage("Leaderboards")).toBe(
      "Leaderboards isn't available in this academy.",
    );
  });

  it("tells a plan gate apart from a permission denial", () => {
    const plan = new ClientApiError("ENTITLEMENT_REQUIRED", 403, "req", "Not on plan");
    const denied = new ClientApiError("PERMISSION_DENIED", 403, "req", "No");
    expect(isNotOnPlan(plan)).toBe(true);
    expect(isAuthorizationDenied(plan)).toBe(false);
    expect(isAuthorizationDenied(denied)).toBe(true);
  });
});
