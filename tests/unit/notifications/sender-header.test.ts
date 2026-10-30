import { describe, expect, it } from "vitest";
import { createTransport } from "../../../backend/apps/api/node_modules/nodemailer";
import {
  SmtpEmailProvider,
  channelSender,
  parseSenderMailbox,
} from "../../../backend/apps/api/src/server/notifications/notification.email-provider";

/**
 * A tenant's sender name is free text (up to 120 characters, set by its
 * admins). The provider hands it to nodemailer as { name, address }, so it is
 * encoded as a display name and never re-parsed as an address list (launch
 * plan task 1.7: nodemailer's address-parser advisories, fixed in 10.1.4).
 * The real nodemailer builds the message here; only the network is replaced.
 */
async function fromHeader(
  fromName: string,
  fromEmail = "academy@example.test",
  platformSender = "sender@example.test",
): Promise<string> {
  let raw = "";
  const provider = new SmtpEmailProvider(
    { SMTP_HOST: "smtp.test", NOTIFICATION_EMAIL_FROM: platformSender },
    (() => {
      const stream = createTransport({ streamTransport: true, buffer: true });
      return {
        sendMail: async (message: Parameters<typeof stream.sendMail>[0]) => {
          const info = await stream.sendMail(message);
          raw = String(info.message);
          return { accepted: [message.to] };
        },
        close: () => undefined,
      };
    }) as never,
  );
  await provider.send({
    tenantId: null,
    to: "learner@example.test",
    subject: "Welcome",
    body: "<p>Hi</p>",
    requestId: "request",
    fromName,
    fromEmail,
  });
  return /^From: (.*(?:\r\n[ \t].*)*)/m.exec(raw)?.[1] ?? "";
}

describe("the sender header", () => {
  it("keeps an ordinary display name", async () => {
    expect(await fromHeader("Example Academy")).toBe("Example Academy <academy@example.test>");
  });

  it.each([
    'Support" <attacker@example.test>, "x',
    "Support <attacker@example.test>",
    "Support (attacker@example.test)",
    "Support; attacker@example.test",
  ])("cannot change the sender address with the name %s", async (name) => {
    const header = await fromHeader(name);
    // The only address in the header is the configured one: anything else
    // stays inside the quoted or encoded display name.
    expect(header.endsWith("<academy@example.test>")).toBe(true);
    expect(header.replace(/"(?:[^"\\]|\\.)*"/g, "")).not.toContain("attacker@");
  });
});

/**
 * A tenant channel with no From email sends as NOTIFICATION_EMAIL_FROM. It used
 * to send as noreply@localhost.test, which ZeptoMail refuses (staging, 25
 * October 2026).
 */
describe("a channel without a sender address", () => {
  const platform = "Example Academy (staging) <no-reply@example.test>";

  it("sends as the platform mailbox, name and address", async () => {
    const sender = channelSender({ fromName: "", fromEmail: "" });
    expect(await fromHeader(sender.fromName, sender.fromEmail, platform)).toBe(
      '"Example Academy (staging)" <no-reply@example.test>',
    );
  });

  it("keeps the tenant's name on the platform address", async () => {
    const sender = channelSender({ fromName: "Example Academy", fromEmail: " " });
    expect(await fromHeader(sender.fromName, sender.fromEmail, platform)).toBe(
      "Example Academy <no-reply@example.test>",
    );
  });

  it("keeps a tenant's own address, named Academy when it has no name", () => {
    expect(channelSender({ fromName: "", fromEmail: "team@example.test" })).toEqual({
      fromName: "Academy",
      fromEmail: "team@example.test",
    });
  });

  it.each([
    ["no-reply@example.test", { name: "", address: "no-reply@example.test" }],
    [
      "Example Academy <no-reply@example.test>",
      { name: "Example Academy", address: "no-reply@example.test" },
    ],
    [
      '"Example, Academy" <no-reply@example.test>',
      { name: "Example, Academy", address: "no-reply@example.test" },
    ],
  ])("reads the mailbox %s", (value, expected) => {
    expect(parseSenderMailbox(value)).toEqual(expected);
  });
});
