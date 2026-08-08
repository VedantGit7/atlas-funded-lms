import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
  updateAutomationRule,
} from "../../../backend/apps/api/src/server/automation/automation.service";
import { handleAutomationOutboxEvent } from "../../../backend/apps/api/src/server/automation/automation.worker";
import {
  listLocaleResources,
  upsertLocaleResources,
} from "../../../backend/apps/api/src/server/locales/locale.service";
import { issueCertificate } from "../../../backend/apps/api/src/server/certificates/certificate.service";
import { publishAssessmentForTests } from "../../../backend/apps/api/src/server/assessments/assessments.service";
import {
  adminCtx,
  authoringTenantTx,
  createCertificateFixture,
} from "../../fixtures/certificate-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("automation and locale integration", () => {
  it("creates rules, emits outbox events, upserts locales, and rejects tenant_id in body", async () => {
    const fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_automation_admin");

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createAutomationRule(tx, admin, {
        key: "cert.notify",
        triggerEventType: "certificate.issued",
        conditionJson: { type: "always" },
        actionJson: {
          type: "notification.request",
          templateKey: "certificate.issued",
          membershipIdField: "membershipId",
        },
      }),
    );

    expect(created.data.key).toBe("cert.notify");

    await expect(
      withTenantTx(authoringTenantTx(fixture), async (tx) =>
        createAutomationRule(tx, admin, {
          key: "cert.notify",
          triggerEventType: "certificate.issued",
          conditionJson: { type: "always" },
          actionJson: {
            type: "notification.request",
            templateKey: "certificate.issued",
          },
        }),
      ),
    ).rejects.toThrow();

    const locales = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      upsertLocaleResources(tx, admin, "en", {
        resources: [{ key: "welcome.title", value: "Welcome" }],
      }),
    );
    expect(locales.data[0]?.value).toBe("Welcome");

    const listedLocales = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      listLocaleResources(tx, admin),
    );
    expect(listedLocales.data.some((row) => row.key === "welcome.title")).toBe(true);

    const outbox = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type
        from outbox_events
        where event_type in ('automation.rule.created', 'automation.rule.updated')
      `,
    );
    expect(outbox.some((row) => row.event_type === "automation.rule.created")).toBe(true);

    const audit = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action from audit_entries where action like 'automation.%'
      `,
    );
    expect(audit).toHaveLength(0);

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      updateAutomationRule(tx, admin, {
        id: created.data.id,
        status: "INACTIVE",
      }),
    );

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      deleteAutomationRule(tx, admin, { id: created.data.id }),
    );

    const rules = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      listAutomationRules(tx, admin),
    );
    expect(rules.data.find((rule) => rule.id === created.data.id)).toBeUndefined();
  });

  it("runs automation once for replayed source events", async () => {
    const fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_automation_worker");

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createAutomationRule(tx, admin, {
        key: "cert.request",
        triggerEventType: "certificate.issued",
        actionJson: {
          type: "notification.request",
          templateKey: "certificate.issued",
        },
      }),
    );

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await publishAssessmentForTests(tx, fixture.assessmentId);
    });

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      issueCertificate(
        tx,
        admin,
        {
          templateId: fixture.publishedTemplateId,
          recipientMembershipId: fixture.learnerMembershipId,
          source: { type: "assessment", id: fixture.assessmentId },
        },
        "automation-worker-issue",
      ),
    );

    const sourceEvent = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string; payload_json: unknown }>>`
        select id::text, payload_json
        from outbox_events
        where event_type = 'certificate.issued'
        order by occurred_at desc
        limit 1
      `,
    );
    const event = sourceEvent[0];
    if (!event) throw new Error("Expected certificate.issued event");

    const workerEvent = {
      id: event.id,
      eventType: "certificate.issued",
      tenantId: fixture.tenantId,
      payload: event.payload_json,
      requestId: "req_automation_worker",
    };

    await handleAutomationOutboxEvent(workerEvent);
    await handleAutomationOutboxEvent(workerEvent);

    const runs = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count from automation_runs
      `,
    );
    expect(runs[0]?.count).toBe(1);

    const requested = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count
        from outbox_events
        where event_type = 'notification.requested'
      `,
    );
    expect(requested[0]?.count).toBe(1);
  });
});
