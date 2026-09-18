import { describe, expect, it } from "vitest";
import { handleNotificationSourceOutboxEvent } from "../../../backend/apps/api/src/server/notifications/notification.worker";
import { publishSecurityEvent } from "../../../backend/apps/api/src/server/notifications/security-notification.service";
import { upsertMemberNotificationPreferences } from "@atlas/membership";
import { withTenantTx } from "@atlas/db";
import { createCertificateFixture, learnerCtx } from "../../fixtures/certificate-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("security notification worker", () => {
  it("skips dispatch when member opted out of security alerts", async () => {
    const fixture = await createCertificateFixture();
    const learner = learnerCtx(fixture, "req_security_opt_out");

    await withTenantTx(
      {
        tenantId: fixture.tenantId,
        requestId: learner.requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => {
        await upsertMemberNotificationPreferences({
          tx,
          tenantId: fixture.tenantId,
          membershipId: fixture.learnerMembershipId,
          // The value is a per-channel record, not a boolean. Passing `false`
          // read as `undefined` for both channels, which defaults to enabled — so
          // the member was never opted out and this test asserted nothing.
          preferences: { "security.password_changed": { email: false, inApp: false } },
        });

        await publishSecurityEvent(tx, learner, {
          eventType: "security.password_changed",
          membershipId: fixture.learnerMembershipId,
          email: "learner@example.com",
          siteUrl: "https://acme-academy.example.com",
        });
      },
    );

    const outbox = await withTenantTx(
      {
        tenantId: fixture.tenantId,
        requestId: "req_security_read",
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        tx.$queryRaw<Array<{ id: string; payload_json: unknown }>>`
          select id::text, payload_json
          from outbox_events
          where event_type = 'security.password_changed'
          order by occurred_at desc
          limit 1
        `,
    );

    const sourceEvent = outbox[0];
    if (!sourceEvent) throw new Error("Expected security.password_changed outbox event");

    await handleNotificationSourceOutboxEvent({
      id: sourceEvent.id,
      eventType: "security.password_changed",
      tenantId: fixture.tenantId,
      payload: sourceEvent.payload_json,
      requestId: "req_security_worker",
    });

    const dispatches = await withTenantTx(
      {
        tenantId: fixture.tenantId,
        requestId: "req_security_count",
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count
          from notification_dispatches
          where tenant_id = ${fixture.tenantId}::uuid
            and membership_id = ${fixture.learnerMembershipId}::uuid
            and template_key = 'security.password_changed'
        `,
    );

    expect(dispatches[0]?.count ?? 0).toBe(0);
  });
});
