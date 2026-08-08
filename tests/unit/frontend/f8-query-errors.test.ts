import { describe, expect, it } from "vitest";
import { ClientApiError, ServerApiError } from "../../../frontend/apps/web/src/lib/api/errors";
import { queryKeys } from "../../../frontend/apps/web/src/lib/api/query-keys";
import { withQueryHost } from "../../../frontend/apps/web/src/lib/api/query-host";
import { loadPersonalizedDashboardActions } from "../../../frontend/apps/web/src/features/learner/server/load-personalized-dashboard";

describe("F8 query keys", () => {
  it("scopes tenant keys under atlas root with host", () => {
    expect(queryKeys.me("tenant.test")).toEqual([
      "atlas",
      "me",
      { host: "tenant.test" },
    ]);
    expect(queryKeys.courses.detail("course-1", "tenant.test")[2]).toBe("course-1");
  });

  it("keeps platform keys distinct from learner keys", () => {
    const platform = queryKeys.platform.shell("platform.localhost");
    const learner = queryKeys.me("fundedbeyond.localhost.test");
    expect(platform).not.toEqual(learner);
    expect(withQueryHost(["atlas", "platform"], "platform.localhost")[1]).toBe("platform");
  });
});

describe("F8 API error mappers", () => {
  it("preserves code status and requestId on client errors", () => {
    const error = new ClientApiError("auth.invalid", 401, "req-1", "Invalid credentials");
    expect(error.code).toBe("auth.invalid");
    expect(error.status).toBe(401);
    expect(error.requestId).toBe("req-1");
    expect(error.message).toBe("Invalid credentials");
  });

  it("preserves code status and requestId on server errors", () => {
    const error = new ServerApiError("tenant.not_found", 404, "req-2", "Tenant not found");
    expect(error.name).toBe("ServerApiError");
    expect(error.status).toBe(404);
  });
});

describe("F8 personalized dashboard loader", () => {
  it("exports loadPersonalizedDashboardActions for Suspense island", () => {
    expect(typeof loadPersonalizedDashboardActions).toBe("function");
  });
});
