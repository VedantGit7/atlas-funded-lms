import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const notificationPaths = [
  "app/admin/notifications/templates/page.tsx",
  "app/(learner)/notifications/page.tsx",
  "app/api/v1/notification-templates/route.ts",
  "app/api/v1/me/notifications/route.ts",
  "app/api/v1/me/notifications/[id]/read/route.ts",
  "server/notifications/notification.service.ts",
  "server/notifications/notification.worker.ts",
  "features/notifications/components/NotificationTemplateManager.tsx",
  "features/notifications/components/LearnerNotificationsClient.tsx",
];

describe("notification e2e wiring", () => {
  it("includes approved screens, APIs, and worker wiring", () => {
    for (const relativePath of notificationPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("learner inbox marks read before navigation", () => {
    const source = readFileSync(
      resolve(webRoot, "features/notifications/components/LearnerNotificationsClient.tsx"),
      "utf8",
    );
    expect(source).toContain("/read");
    expect(source).toContain("router.push(item.actionPath)");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("worker sends email only through provider abstraction", () => {
    const workerSource = readFileSync(
      resolve(webRoot, "server/notifications/notification.worker.ts"),
      "utf8",
    );
    expect(workerSource).toContain("getEmailProvider");
    expect(workerSource).not.toMatch(/sendMail|sendEmail|resend|nodemailer/i);
    expect(workerSource).toContain("NOTIFICATION_QUEUED_EVENT");
  });

  it("source worker excludes notification.queued recursion", () => {
    const workerSource = readFileSync(
      resolve(webRoot, "server/notifications/notification.worker.ts"),
      "utf8",
    );
    expect(workerSource).toContain("if (event.eventType === NOTIFICATION_QUEUED_EVENT)");
  });
});
