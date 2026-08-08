import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

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
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("learner inbox marks read before navigation", () => {
    const source = readFileSync(
      resolveSplitPath("features/notifications/components/LearnerNotificationsClient.tsx"),
      "utf8",
    );
    expect(source).toContain("/read");
    expect(source).toContain("router.push(item.actionPath)");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("mark-read route binds notification id from path params", () => {
    const source = readFileSync(
      resolveSplitPath("app/api/v1/me/notifications/[id]/read/route.ts"),
      "utf8",
    );
    expect(source).toContain("notificationParamsSchema");
    expect(source).toContain("params: notificationParamsSchema");
    expect(source).toContain("params.id");
  });

  it("worker sends email only through provider abstraction", () => {
    const workerSource = readFileSync(
      resolveSplitPath("server/notifications/notification.worker.ts"),
      "utf8",
    );
    expect(workerSource).toContain("getEmailProvider");
    expect(workerSource).not.toMatch(/sendMail|sendEmail|resend|nodemailer/i);
    expect(workerSource).toContain("NOTIFICATION_QUEUED_EVENT");
  });

  it("source worker excludes notification.queued recursion", () => {
    const workerSource = readFileSync(
      resolveSplitPath("server/notifications/notification.worker.ts"),
      "utf8",
    );
    expect(workerSource).toContain("if (event.eventType === NOTIFICATION_QUEUED_EVENT)");
  });
});
