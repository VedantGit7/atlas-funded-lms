import "server-only";
import {
  DEVICE_ALERTS_DEFAULTS,
  deviceAlertsPath,
  type DeviceAlertsPayload,
} from "../../features/admin/reports/admin-active-devices-alerts-api";
import {
  DEVICE_POLICIES_PATH,
  type DevicePoliciesPayload,
} from "../../features/admin/reports/admin-active-devices-policies-api";
import {
  activeDevicesLearnerDetailPath,
  activeDevicesSessionDetailPath,
  type ActiveDevicesLearnerDetail,
  type ActiveDevicesSessionDetail,
} from "../../features/admin/reports/admin-active-devices-roster-api";
import { loadReportInitialData } from "./report-initial-data";

/*
 * The first data each Active devices page shows, loaded on the server so the
 * page arrives filled in. Every path is the one the page's own first browser
 * load would request, so the page can skip that load; each resolves null on
 * failure and the page then loads in the browser as before.
 */

/** The first page of open alerts. */
export function loadDeviceAlertsData() {
  return loadReportInitialData<DeviceAlertsPayload>(deviceAlertsPath(DEVICE_ALERTS_DEFAULTS));
}

export function loadDevicePoliciesData() {
  return loadReportInitialData<DevicePoliciesPayload>(DEVICE_POLICIES_PATH);
}

export function loadActiveDevicesLearnerData(membershipId: string) {
  return loadReportInitialData<ActiveDevicesLearnerDetail>(
    activeDevicesLearnerDetailPath(membershipId),
  );
}

export function loadActiveDevicesSessionData(membershipId: string, deviceId: string) {
  return loadReportInitialData<ActiveDevicesSessionDetail>(
    activeDevicesSessionDetailPath(membershipId, deviceId),
  );
}
