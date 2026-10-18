import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ paths: [] as string[], fail: false }));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (path: string) => {
      state.paths.push(path);
      return state.fail
        ? Promise.reject(new Error("The report is unavailable."))
        : Promise.resolve({ data: { path } });
    },
  },
}));

const devices =
  await import("../../../frontend/apps/web/src/lib/server/report-active-devices-initial-data");

beforeEach(() => {
  state.paths = [];
  state.fail = false;
});

/*
 * Each Active devices page skips its first browser load when the server sent
 * data, so the server must ask for exactly what that load would have. These
 * are the requests the pages made in the browser before they were
 * server-rendered.
 */
describe("Active devices initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await devices.loadDeviceAlertsData();
    await devices.loadDevicePoliciesData();
    await devices.loadActiveDevicesLearnerData("mem-1");
    await devices.loadActiveDevicesSessionData("mem-1", "dev-1");
    expect(state.paths).toEqual([
      "/api/v1/reports/active-devices/alerts?status=open&page=1&limit=50",
      "/api/v1/reports/active-devices/policies",
      "/api/v1/reports/active-devices/roster/mem-1",
      "/api/v1/reports/active-devices/roster/mem-1/dev-1",
    ]);
  });

  it("keeps ids from the address inside their own path segments", async () => {
    await devices.loadActiveDevicesLearnerData("alerts?x=1");
    await devices.loadActiveDevicesSessionData("a/b", "c?d");
    expect(state.paths).toEqual([
      "/api/v1/reports/active-devices/roster/alerts%3Fx%3D1",
      "/api/v1/reports/active-devices/roster/a%2Fb/c%3Fd",
    ]);
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(devices.loadDeviceAlertsData()).resolves.toBeNull();
    await expect(devices.loadDevicePoliciesData()).resolves.toBeNull();
    await expect(devices.loadActiveDevicesLearnerData("mem-1")).resolves.toBeNull();
    await expect(devices.loadActiveDevicesSessionData("mem-1", "dev-1")).resolves.toBeNull();
  });
});
