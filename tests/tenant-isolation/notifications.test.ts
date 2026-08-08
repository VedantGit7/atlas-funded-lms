import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { notificationRepository } from "../../backend/apps/api/src/server/notifications/notification.repository";
import {
  createNotificationTemplate,
  markNotificationRead,
} from "../../backend/apps/api/src/server/notifications/notification.service";
import {
  adminCtx,
  authoringTenantTx,
  createCertificateFixture,
} from "../fixtures/certificate-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const NOTIFICATION_TABLES = ["notification_templates", "notification_dispatches"] as const;

describeWithDb("notification tenant isolation", () => {
  it("RLS filters notification tables to current tenant", async () => {
    const fixture = await createCertificateFixture();
    const isolation = await createTenantIsolationFixture();
    const admin = adminCtx(fixture, "req_iso_template");

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createNotificationTemplate(tx, admin, {
        key: "certificate.issued",
        channel: "in_app",
        locale: "en",
        body: "Hello {{issuedAt}}",
        variablesJson: { variables: [{ name: "issuedAt" }] },
      }),
    );

    for (const table of NOTIFICATION_TABLES) {
      const rows = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
        tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(
          `select tenant_id::text from ${table} where tenant_id = $1::uuid`,
          fixture.tenantId,
        ),
      );

      expect(rows).toHaveLength(0);
    }
  });

  it("prevents cross-tenant mark-read", async () => {
    const fixture = await createCertificateFixture();
    const isolation = await createTenantIsolationFixture();
    const admin = adminCtx(fixture, "req_iso_mark_read");

    await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createNotificationTemplate(tx, admin, {
        key: "certificate.issued",
        channel: "in_app",
        locale: "en",
        body: "Hello {{issuedAt}}",
        variablesJson: { variables: [{ name: "issuedAt" }] },
      }),
    );

    const dispatch = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      notificationRepository.insertDispatch(tx, {
        tenantId: fixture.tenantId,
        membershipId: fixture.learnerMembershipId,
        channel: "in_app",
        templateKey: "certificate.issued",
        destination: null,
        idempotencyKey: "iso-test-dispatch",
        status: "SENT",
        payloadJson: {
          inbox: {
            title: "Certificate issued",
            body: "Hello",
            actionPath: "/certificates",
            readAt: null,
          },
        },
        sentAt: new Date(),
      }),
    );

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        markNotificationRead(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_foreign_mark_read",
          },
          dispatch.id,
        ),
      ),
    ).rejects.toThrow();
  });
});
