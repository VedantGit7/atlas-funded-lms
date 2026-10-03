import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  setEmailProviderForTests,
  type EmailSendInput,
} from "../../../backend/apps/api/src/server/notifications/notification.email-provider";
import {
  handleNotificationQueuedOutboxEvent,
  handleNotificationSourceOutboxEvent,
} from "../../../backend/apps/api/src/server/notifications/notification.worker";
import {
  createNotificationTemplate,
  deleteNotificationTemplate,
  listMyNotifications,
  listNotificationTemplates,
  markNotificationRead,
} from "../../../backend/apps/api/src/server/notifications/notification.service";
import { issueCertificate } from "../../../backend/apps/api/src/server/certificates/certificate.service";
import { publishAssessmentForTests } from "../../../backend/apps/api/src/server/assessments/assessments.service";
import {
  adminCtx,
  authoringTenantTx,
  createCertificateFixture,
  learnerCtx,
} from "../../fixtures/certificate-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("notification integration", () => {
  const sendEmail = vi.fn<(input: EmailSendInput) => Promise<void>>();
  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue(undefined);
    setEmailProviderForTests({ isConfigured: () => true, send: sendEmail });
  });
  afterEach(() => setEmailProviderForTests(null));

  it("creates templates, dispatches from certificate events, and marks read without audit/outbox", async () => {
    const fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_notification_admin");
    const learner = learnerCtx(fixture, "req_notification_learner");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await publishAssessmentForTests(tx, fixture.assessmentId);
    });

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createNotificationTemplate(tx, admin, {
        key: "certificate.issued",
        channel: "in_app",
        locale: "en",
        body: "Issued on {{issuedAt}}",
        variablesJson: {
          variables: [{ name: "issuedAt" }],
          defaultActionPath: "/certificates",
        },
      }),
    );

    expect(created.data.channel).toBe("in_app");

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      issueCertificate(
        tx,
        admin,
        {
          templateId: fixture.publishedTemplateId,
          recipientMembershipId: fixture.learnerMembershipId,
          source: { type: "assessment", id: fixture.assessmentId },
        },
        "notification-issue",
      ),
    );

    const outbox = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string; event_type: string; payload_json: unknown }>>`
          select id::text, event_type, payload_json
          from outbox_events
          where event_type = 'certificate.issued'
          order by occurred_at desc
          limit 1
        `,
    );

    const sourceEvent = outbox[0];
    if (!sourceEvent) throw new Error("Expected certificate.issued outbox event");

    await handleNotificationSourceOutboxEvent({
      id: sourceEvent.id,
      eventType: "certificate.issued",
      tenantId: fixture.tenantId,
      payload: sourceEvent.payload_json,
      requestId: "req_notification_source",
    });

    await handleNotificationSourceOutboxEvent({
      id: sourceEvent.id,
      eventType: "certificate.issued",
      tenantId: fixture.tenantId,
      payload: sourceEvent.payload_json,
      requestId: "req_notification_source_replay",
    });

    const dispatches = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count
          from notification_dispatches
          where tenant_id = ${fixture.tenantId}::uuid
            and membership_id = ${fixture.learnerMembershipId}::uuid
        `,
    );
    expect(dispatches[0]?.count).toBe(1);

    const queued = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string; payload_json: unknown }>>`
          select id::text, payload_json
          from outbox_events
          where event_type = 'notification.queued'
            and payload_json->>'channel' = 'email'
          order by occurred_at desc
          limit 1
        `,
    );
    const queuedEvent = queued[0];
    if (!queuedEvent) throw new Error("Expected notification.queued outbox event");

    await handleNotificationQueuedOutboxEvent({
      id: queuedEvent.id,
      eventType: "notification.queued",
      tenantId: fixture.tenantId,
      payload: queuedEvent.payload_json,
      requestId: "req_notification_queued",
    });

    await handleNotificationQueuedOutboxEvent({
      id: queuedEvent.id,
      eventType: "notification.queued",
      tenantId: fixture.tenantId,
      payload: queuedEvent.payload_json,
      requestId: "req_notification_queued_replay",
    });

    // The controlled provider is invoked once; replay observes the persisted
    // receipt instead of reporting a false delivery or sending a second email.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: fixture.tenantId,
        idempotencyKey: expect.any(String),
      }),
    );
    const emailReceipts = await withTenantTx(
      authoringTenantTx(fixture),
      (tx) =>
        tx.$queryRaw<Array<{ status: string }>>`
        select status from notification_dispatches
        where membership_id = ${fixture.learnerMembershipId}::uuid
          and channel = 'email'
      `,
    );
    expect(emailReceipts).toEqual([{ status: "SENT" }]);

    const inbox = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listMyNotifications(tx, learner, { limit: 25 }),
    );
    expect(inbox.data).toHaveLength(1);
    expect(inbox.data[0]?.read).toBe(false);

    const outboxBeforeMarkRead = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count from outbox_events
        `,
    );

    const notificationId = inbox.data[0]?.id;
    if (!notificationId) throw new Error("Expected inbox notification");

    const firstRead = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => markNotificationRead(tx, learner, notificationId),
    );
    const secondRead = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => markNotificationRead(tx, learner, notificationId),
    );

    expect(firstRead.data.readAt).toBe(secondRead.data.readAt);

    const outboxAfterMarkRead = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count from outbox_events
        `,
    );
    expect(outboxAfterMarkRead[0]?.count).toBe(outboxBeforeMarkRead[0]?.count);

    const auditCount = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count
          from audit_entries
          where action like 'notification.%'
        `,
    );
    expect(auditCount[0]?.count).toBe(0);

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      deleteNotificationTemplate(tx, admin, { id: created.data.id }),
    );

    const templates = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      listNotificationTemplates(tx, admin),
    );
    expect(templates.data.some((template) => template.id === created.data.id)).toBe(false);
    expect(inbox.data).toHaveLength(1);
  });

  it("returns conflict for duplicate template keys", async () => {
    const fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_notification_conflict");

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createNotificationTemplate(tx, admin, {
        key: "certificate.issued",
        channel: "in_app",
        locale: "en",
        body: "Hello {{issuedAt}}",
        variablesJson: { variables: [{ name: "issuedAt" }] },
      }),
    );

    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        createNotificationTemplate(tx, admin, {
          key: "certificate.issued",
          channel: "in_app",
          locale: "en",
          body: "Duplicate {{issuedAt}}",
          variablesJson: { variables: [{ name: "issuedAt" }] },
        }),
      ),
    ).rejects.toThrow(/already exists/i);
  });
});
