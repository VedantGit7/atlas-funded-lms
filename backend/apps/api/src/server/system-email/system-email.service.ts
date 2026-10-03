import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { getEmailProvider } from "../notifications/notification.email-provider";
import { notificationRepository } from "../notifications/notification.repository";
import { notificationSourceEventKeySchema } from "../notifications/notification.dto";
import { readTenantEmailChannel } from "../tenant-settings/tenant-settings.service";
import {
  getSystemEmailCatalogEntry,
  renderSystemEmailText,
  sampleVariablesFromDefs,
  SYSTEM_EMAIL_CATALOG,
  type SystemEmailCatalogEntry,
} from "./system-email.catalog";
import {
  previewSystemEmailResponseSchema,
  setSystemEmailEnabledBodySchema,
  systemEmailResponseSchema,
  systemEmailsListResponseSchema,
  testSystemEmailBodySchema,
  testSystemEmailResponseSchema,
  updateSystemEmailBodySchema,
} from "./system-email.schemas";

const LOCALE = "en";
const CHANNEL = "email";

function notFound(message = "System email not found.") {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message,
  });
}

function validationError(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

type EmailOverride = Awaited<ReturnType<typeof notificationRepository.findTemplateByUniqueKey>>;

function toDto(entry: SystemEmailCatalogEntry, override: EmailOverride) {
  const enabled = !(override?.status === "INACTIVE" || override?.status === "ARCHIVED");
  const subject = override?.subject?.trim() || entry.defaultSubject;
  const body = override?.body.trim() || entry.defaultBody;
  const isCustomized = Boolean(
    override &&
    (override.subject?.trim() !== entry.defaultSubject ||
      override.body.trim() !== entry.defaultBody ||
      override.status !== "ACTIVE"),
  );

  return {
    key: entry.key,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    enabled,
    isCustomized,
    subject,
    body,
    defaultSubject: entry.defaultSubject,
    defaultBody: entry.defaultBody,
    defaultActionPath: entry.defaultActionPath,
    templateId: override?.id ?? null,
    updatedAt: override?.updated_at.toISOString() ?? null,
  };
}

async function loadOverride(tx: TenantTx, tenantId: string, key: string) {
  return notificationRepository.findTemplateByUniqueKey(tx, {
    tenantId,
    key,
    channel: CHANNEL,
    locale: LOCALE,
  });
}

function requireEntry(key: string) {
  const parsed = notificationSourceEventKeySchema.safeParse(key);
  if (!parsed.success) throw notFound();
  const entry = getSystemEmailCatalogEntry(parsed.data);
  if (!entry) throw notFound();
  return entry;
}

async function upsertEmailTemplate(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    key: string;
    subject: string;
    body: string;
    status: "ACTIVE" | "INACTIVE";
    existing: EmailOverride;
  },
) {
  if (args.existing) {
    return notificationRepository.updateTemplate(tx, {
      templateId: args.existing.id,
      subject: args.subject,
      body: args.body,
      status: args.status,
    });
  }

  return notificationRepository.insertTemplate(tx, {
    tenantId: ctx.tenantId,
    key: args.key,
    channel: CHANNEL,
    locale: LOCALE,
    subject: args.subject,
    body: args.body,
    variablesJson: { variables: [] },
    status: args.status,
  });
}

export async function listSystemEmails(tx: TenantTx, ctx: ServiceCtx) {
  const items = [];
  for (const entry of SYSTEM_EMAIL_CATALOG) {
    const override = await loadOverride(tx, ctx.tenantId, entry.key);
    items.push(toDto(entry, override));
  }
  return systemEmailsListResponseSchema.parse({ data: { items } });
}

export async function getSystemEmail(tx: TenantTx, ctx: ServiceCtx, key: string) {
  const entry = requireEntry(key);
  const override = await loadOverride(tx, ctx.tenantId, entry.key);
  return systemEmailResponseSchema.parse({ data: toDto(entry, override) });
}

export async function updateSystemEmail(
  tx: TenantTx,
  ctx: ServiceCtx,
  key: string,
  rawBody: unknown,
) {
  const body = updateSystemEmailBodySchema.parse(rawBody);
  const entry = requireEntry(key);
  const existing = await loadOverride(tx, ctx.tenantId, entry.key);
  const status =
    existing?.status === "INACTIVE" || existing?.status === "ARCHIVED" ? "INACTIVE" : "ACTIVE";

  await upsertEmailTemplate(tx, ctx, {
    key: entry.key,
    subject: body.subject,
    body: body.body,
    status,
    existing,
  });

  return getSystemEmail(tx, ctx, entry.key);
}

export async function resetSystemEmail(tx: TenantTx, ctx: ServiceCtx, key: string) {
  const entry = requireEntry(key);
  const existing = await loadOverride(tx, ctx.tenantId, entry.key);
  if (existing) {
    await notificationRepository.deleteTemplate(tx, existing.id);
  }
  return getSystemEmail(tx, ctx, entry.key);
}

export async function setSystemEmailEnabled(
  tx: TenantTx,
  ctx: ServiceCtx,
  key: string,
  rawBody: unknown,
) {
  const body = setSystemEmailEnabledBodySchema.parse(rawBody);
  const entry = requireEntry(key);
  const existing = await loadOverride(tx, ctx.tenantId, entry.key);

  if (body.enabled) {
    if (!existing) {
      // Default state is already enabled — nothing to store.
      return getSystemEmail(tx, ctx, entry.key);
    }
    if (
      existing.subject?.trim() === entry.defaultSubject &&
      existing.body.trim() === entry.defaultBody
    ) {
      // Only existed to disable — remove override to restore defaults.
      await notificationRepository.deleteTemplate(tx, existing.id);
      return getSystemEmail(tx, ctx, entry.key);
    }
    await notificationRepository.updateTemplate(tx, {
      templateId: existing.id,
      status: "ACTIVE",
    });
    return getSystemEmail(tx, ctx, entry.key);
  }

  await upsertEmailTemplate(tx, ctx, {
    key: entry.key,
    subject: existing?.subject?.trim() || entry.defaultSubject,
    body: existing?.body.trim() || entry.defaultBody,
    status: "INACTIVE",
    existing,
  });

  return getSystemEmail(tx, ctx, entry.key);
}

export async function previewSystemEmail(tx: TenantTx, ctx: ServiceCtx, key: string) {
  const entry = requireEntry(key);
  const override = await loadOverride(tx, ctx.tenantId, entry.key);
  const dto = toDto(entry, override);
  const sampleVariables = sampleVariablesFromDefs(entry.variables);
  return previewSystemEmailResponseSchema.parse({
    data: {
      subject: renderSystemEmailText(dto.subject, sampleVariables),
      body: renderSystemEmailText(dto.body, sampleVariables),
      sampleVariables,
      variables: entry.variables.map((variable) => ({
        key: variable.key,
        sample: variable.sample,
        description: variable.description,
      })),
      defaultActionPath: entry.defaultActionPath,
    },
  });
}

async function resolveTransactionalSender(tx: TenantTx) {
  const channel = await readTenantEmailChannel(tx, "transactionalEmail");
  const provider = getEmailProvider();
  const fromEmail = channel.fromEmail.trim();
  const fromName = channel.fromName.trim();
  if ((!fromEmail || !fromName) && !provider.isConfigured()) {
    throw validationError(
      "Configure Transactional Email channel settings (From name and From email) before sending.",
    );
  }
  return {
    fromName: fromName || "Academy",
    fromEmail: fromEmail || "noreply@localhost.test",
    replyToEmail: channel.replyToEmail,
  };
}

export async function testSystemEmail(
  tx: TenantTx,
  ctx: ServiceCtx,
  key: string,
  rawBody: unknown,
) {
  const body = testSystemEmailBodySchema.parse(rawBody);
  const entry = requireEntry(key);
  const override = await loadOverride(tx, ctx.tenantId, entry.key);
  const dto = toDto(entry, override);
  if (!dto.enabled) {
    throw validationError("Enable this system email before sending a test.");
  }

  const provider = getEmailProvider();
  if (!provider.isConfigured()) {
    throw validationError(
      "Email provider is not configured. Set NOTIFICATION_EMAIL_PROVIDER=mock for local delivery.",
    );
  }

  const sender = await resolveTransactionalSender(tx);
  const sampleVariables = sampleVariablesFromDefs(entry.variables);
  const subject = renderSystemEmailText(dto.subject, sampleVariables);
  const renderedBody = renderSystemEmailText(dto.body, sampleVariables);

  await provider.send({
    tenantId: ctx.tenantId,
    to: body.testEmail,
    subject: `[TEST] ${subject}`,
    body: renderedBody,
    requestId: `system-email.test:${entry.key}:${Date.now()}`,
    fromName: sender.fromName,
    fromEmail: sender.fromEmail,
    replyToEmail: sender.replyToEmail,
  });

  return testSystemEmailResponseSchema.parse({
    data: { sent: true, to: body.testEmail },
  });
}

/** Runtime helper used by the notification worker. */
export async function resolveSystemEmailForSend(
  tx: TenantTx,
  tenantId: string,
  key: string,
): Promise<{
  enabled: boolean;
  subject: string;
  body: string;
  title: string;
  actionPath: string;
  templateId: string | null;
} | null> {
  const entry = getSystemEmailCatalogEntry(key);
  if (!entry) return null;
  const override = await loadOverride(tx, tenantId, entry.key);
  const dto = toDto(entry, override);
  return {
    enabled: dto.enabled,
    subject: dto.subject,
    body: dto.body,
    title: entry.defaultTitle,
    actionPath: entry.defaultActionPath,
    templateId: dto.templateId,
  };
}
