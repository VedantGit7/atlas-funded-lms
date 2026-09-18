// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { isInboxSentinelTemplateKey } from "./notification.dto";
import { notificationDispatchNotFound, notificationTemplateNotFound } from "./notification.errors";
import { notificationRepository } from "./notification.repository";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadNotificationTemplateCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "notification_template_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export async function loadNotificationTemplateResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  templateId: string;
}) {
  const template = await notificationRepository.findTemplateById(args.tx, args.templateId);

  if (!template || template.tenant_id !== args.ctx.tenantId) {
    throw notificationTemplateNotFound();
  }

  return createTenantResourceRef({
    type: "notification_template",
    id: template.id,
    tenantId: args.ctx.tenantId,
  });
}

export async function loadNotificationTemplateResourceRefFromBody(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  input: { id: string };
}) {
  return loadNotificationTemplateResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    templateId: args.input.id,
  });
}

export function loadSelfNotificationInboxResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "notification_inbox",
      id: args.ctx.actorMembershipId,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: args.ctx.actorMembershipId,
    }),
  );
}

export async function loadSelfNotificationDispatchResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  dispatchId: string;
}) {
  const dispatch = await notificationRepository.findDispatchById(args.tx, args.dispatchId);

  if (
    !dispatch ||
    dispatch.tenant_id !== args.ctx.tenantId ||
    dispatch.membership_id !== args.ctx.actorMembershipId ||
    dispatch.channel !== "in_app" ||
    isInboxSentinelTemplateKey(dispatch.template_key) ||
    dispatch.status !== "SENT"
  ) {
    throw notificationDispatchNotFound();
  }

  return createTenantResourceRef({
    type: "notification_dispatch",
    id: dispatch.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: dispatch.membership_id,
  });
}
