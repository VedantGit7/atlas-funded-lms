import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import {
  ChannelTestEmailSection,
  TestResultCard,
} from "../../../frontend/apps/web/src/features/admin/channel-settings/ChannelTestEmailSection";

const transactionalPage = readFileSync(
  resolve(process.cwd(), "frontend/apps/web/src/app/admin/channels/transactional-email/page.tsx"),
  "utf8",
);

function section(unsavedChanges: boolean) {
  return renderToStaticMarkup(createElement(ChannelTestEmailSection, { unsavedChanges }));
}

const base = { testId: "33333333-3333-4333-8333-333333333333", to: "admin@example.test" };

describe("send a test email", () => {
  it("offers both ways to send", () => {
    const html = section(false);

    expect(html).toContain("Send a test email");
    expect(html).toContain("Send now");
    expect(html).toContain("Through the notification queue");
    expect(html).toContain('role="radiogroup"');
    expect(html).not.toContain("Save your changes first");
  });

  it("waits for unsaved sender changes, since the test uses the saved sender", () => {
    expect(section(true)).toContain("Save your changes first");
  });

  it("is on the Transactional Email page", () => {
    expect(transactionalPage).toMatch(/<EmailChannelPanel[^>]*\sshowTestEmail\s/);
  });

  it("shows a refusal with its code", () => {
    const html = renderToStaticMarkup(
      createElement(TestResultCard, {
        result: {
          ...base,
          mode: "direct",
          status: "failed",
          errorCode: "SMTP_550",
          message: "The mail server refused the email (SMTP 550).",
        },
        gaveUp: false,
      }),
    );

    expect(html).toContain("Not sent to admin@example.test");
    expect(html).toContain("SMTP_550");
    expect(html).toContain("var(--admin-danger)");
  });

  it("shows a sent email", () => {
    const html = renderToStaticMarkup(
      createElement(TestResultCard, {
        result: { ...base, mode: "queued", status: "sent", errorCode: null, message: "Sent." },
        gaveUp: false,
      }),
    );

    expect(html).toContain("Sent to admin@example.test");
    expect(html).toContain("var(--admin-success)");
  });

  it("stops waiting on a silent worker and says so", () => {
    const html = renderToStaticMarkup(
      createElement(TestResultCard, {
        result: { ...base, mode: "queued", status: "queued", errorCode: null, message: "Waiting." },
        gaveUp: true,
      }),
    );

    expect(html).toContain("No answer from the notification worker after a minute");
    expect(html).not.toContain("animate-spin");
  });
});
