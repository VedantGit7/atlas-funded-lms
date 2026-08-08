import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();

vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (...args: unknown[]) => mockGet(...args),
  },
  ServerApiError: class ServerApiError extends Error {
    status: number;
    code: string;

    constructor(args: { status: number; code: string; message: string }) {
      super(args.message);
      this.status = args.status;
      this.code = args.code;
    }
  },
}));

describe("loadLearnerNavigationProjection", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
  });

  it("returns entitlement-filtered navigation when entitlements load", async () => {
    mockGet.mockResolvedValue({
      data: [{ key: "community.enable", enabled: true }],
    });

    const { loadLearnerNavigationProjection } = await import(
      "../../../frontend/apps/web/src/lib/server/learner-navigation-projection"
    );

    const projection = await loadLearnerNavigationProjection();

    expect(projection.enabledEntitlements).toEqual(new Set(["community.enable"]));
    expect(projection.items.some((item) => item.href === "/community")).toBe(true);
    expect(projection.items.some((item) => item.href === "/certificates")).toBe(false);
    expect(projection.items.some((item) => item.href === "/courses")).toBe(true);
  });

  it("falls back to core navigation when entitlements are forbidden", async () => {
    const { ServerApiError } = await import("../../../frontend/apps/web/src/lib/server-api");
    mockGet.mockRejectedValue(
      new ServerApiError({
        status: 403,
        code: "PERMISSION_DENIED",
        message: "Denied",
      }),
    );

    const { loadLearnerNavigationProjection } = await import(
      "../../../frontend/apps/web/src/lib/server/learner-navigation-projection"
    );

    const projection = await loadLearnerNavigationProjection();

    expect(projection.enabledEntitlements).toEqual(new Set());
    expect(projection.items.map((item) => item.href)).toEqual(
      expect.arrayContaining(["/", "/courses", "/roadmap", "/progress", "/resources"]),
    );
    expect(projection.items.some((item) => item.href === "/community")).toBe(false);
  });

  it("falls back to core navigation when entitlements are unavailable", async () => {
    mockGet.mockRejectedValue(new Error("network failure"));

    const { loadLearnerNavigationProjection } = await import(
      "../../../frontend/apps/web/src/lib/server/learner-navigation-projection"
    );

    const projection = await loadLearnerNavigationProjection();

    expect(projection.enabledEntitlements).toEqual(new Set());
    expect(projection.items.some((item) => item.href === "/courses")).toBe(true);
    expect(projection.items.some((item) => item.href === "/achievements")).toBe(false);
  });
});
