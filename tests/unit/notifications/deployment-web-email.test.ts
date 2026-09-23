import { afterEach, expect, it, vi } from "vitest";
import { deploymentEnv } from "../../helpers/deployment-env";
import {
  getEmailProvider,
  setEmailProviderForTests,
} from "../../../backend/apps/api/src/server/notifications/notification.email-provider";
afterEach(() => {
  setEmailProviderForTests(null);
  vi.unstubAllEnvs();
});
it("uses configured SMTP for the canonical notification provider", () => {
  for (const [key, value] of Object.entries(deploymentEnv())) vi.stubEnv(key, value);
  expect(getEmailProvider().isConfigured()).toBe(true);
});
