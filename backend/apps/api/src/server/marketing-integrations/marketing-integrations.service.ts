import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { ensureSelfServiceLearnerMembership, findMembershipByPrincipal } from "@atlas/membership";
import {
  insertEnrollment,
  publishEnrollmentCreatedEvent,
} from "../enrollments/enrollments.repository";
import {
  MARKETING_INTEGRATION_EVENT_KEYS,
  MARKETING_INTEGRATION_EVENT_LABELS,
  createMarketingIntegrationWebhookBodySchema,
  deleteMarketingIntegrationWebhookResponseSchema,
  integrationPaidEnrollmentBodySchema,
  integrationPaidEnrollmentResponseSchema,
  integrationSignUpBodySchema,
  integrationSignUpResponseSchema,
  marketingIntegrationCredentialsResponseSchema,
  marketingIntegrationDeliveriesListResponseSchema,
  marketingIntegrationOverviewResponseSchema,
  marketingIntegrationSnippetsResponseSchema,
  marketingIntegrationWebhookResponseSchema,
  marketingIntegrationWebhooksListResponseSchema,
  publicMarketingIntegrationSnippetsResponseSchema,
  rotateMarketingIntegrationApiKeyResponseSchema,
  testMarketingIntegrationWebhookResponseSchema,
  updateMarketingIntegrationSnippetsBodySchema,
  updateMarketingIntegrationWebhookBodySchema,
  type MarketingIntegrationEventKey,
} from "./marketing-integrations.schemas";
import {
  hashIntegrationApiKey,
  marketingIntegrationsRepository,
  type MarketingIntegrationSettingsRow,
  type MarketingIntegrationWebhookRow,
} from "./marketing-integrations.repository";
import { dispatchMarketingIntegrationWebhooks } from "./marketing-integrations.dispatch";

function notFound(message = "Integration resource not found.") {
  return new AtlasHttpError({ code: "PERMISSION_DENIED", status: 404, message });
}

function validationError(message: string) {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

function authRequired(message = "Invalid or missing integration API key.") {
  return new AtlasHttpError({ code: "AUTH_REQUIRED", status: 401, message });
}

function toWebhookDto(row: MarketingIntegrationWebhookRow) {
  return {
    id: row.id,
    eventKey: row.event_key as MarketingIntegrationEventKey,
    url: row.url,
    enabled: row.enabled,
    lastTestedAt: row.last_tested_at?.toISOString() ?? null,
    lastDeliveryAt: row.last_delivery_at?.toISOString() ?? null,
    lastDeliveryStatus: row.last_delivery_status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toSnippetsDto(row: MarketingIntegrationSettingsRow | null) {
  return {
    siteBodyHtml: row?.site_body_html ?? null,
    orderTrackingHtml: row?.order_tracking_html ?? null,
    signupTrackingHtml: row?.signup_tracking_html ?? null,
    updatedAt: row?.updated_at.toISOString() ?? null,
  };
}

async function deliverWebhook(args: {
  url: string;
  eventKey: string;
  payload: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{ ok: boolean; statusCode: number | null; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 8000);
  try {
    const response = await fetch(args.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Atlas-Marketing-Integrations/1.0",
        "x-atlas-event": args.eventKey,
      },
      body: JSON.stringify({
        event: args.eventKey,
        occurredAt: new Date().toISOString(),
        data: args.payload,
      }),
      signal: controller.signal,
    });
    const message = response.ok
      ? `Delivered with status ${response.status}.`
      : `Remote responded with status ${response.status}.`;
    return { ok: response.ok, statusCode: response.status, message };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook delivery failed.";
    return { ok: false, statusCode: null, message };
  } finally {
    clearTimeout(timer);
  }
}

export async function getMarketingIntegrationSnippets(
  tx: TenantTx,
  _ctx: ServiceCtx,
) {
  const settings = await marketingIntegrationsRepository.getSettings(tx);
  return marketingIntegrationSnippetsResponseSchema.parse({
    data: toSnippetsDto(settings),
  });
}

export async function updateMarketingIntegrationSnippets(
  tx: TenantTx,
  _ctx: ServiceCtx,
  body: unknown,
) {
  const input = updateMarketingIntegrationSnippetsBodySchema.parse(body);
  await marketingIntegrationsRepository.ensureSettings(tx);

  if (input.siteBodyHtml !== undefined) {
    await tx.$executeRaw`
      update marketing_integration_settings
      set site_body_html = ${input.siteBodyHtml}, updated_at = now()
      where tenant_id = app.current_tenant_id()
    `;
  }
  if (input.orderTrackingHtml !== undefined) {
    await tx.$executeRaw`
      update marketing_integration_settings
      set order_tracking_html = ${input.orderTrackingHtml}, updated_at = now()
      where tenant_id = app.current_tenant_id()
    `;
  }
  if (input.signupTrackingHtml !== undefined) {
    await tx.$executeRaw`
      update marketing_integration_settings
      set signup_tracking_html = ${input.signupTrackingHtml}, updated_at = now()
      where tenant_id = app.current_tenant_id()
    `;
  }

  const settings = await marketingIntegrationsRepository.getSettings(tx);
  return marketingIntegrationSnippetsResponseSchema.parse({
    data: toSnippetsDto(settings),
  });
}

export async function listMarketingIntegrationWebhooks(
  tx: TenantTx,
  _ctx: ServiceCtx,
) {
  const rows = await marketingIntegrationsRepository.listWebhooks(tx);
  const byEvent = new Map<MarketingIntegrationEventKey, ReturnType<typeof toWebhookDto>[]>();
  for (const key of MARKETING_INTEGRATION_EVENT_KEYS) {
    byEvent.set(key, []);
  }
  for (const row of rows) {
    const key = row.event_key as MarketingIntegrationEventKey;
    const list = byEvent.get(key);
    if (list) list.push(toWebhookDto(row));
  }

  return marketingIntegrationWebhooksListResponseSchema.parse({
    data: {
      events: MARKETING_INTEGRATION_EVENT_KEYS.map((key) => ({
        key,
        label: MARKETING_INTEGRATION_EVENT_LABELS[key],
        webhooks: byEvent.get(key) ?? [],
      })),
    },
  });
}

export async function createMarketingIntegrationWebhook(
  tx: TenantTx,
  _ctx: ServiceCtx,
  body: unknown,
) {
  const input = createMarketingIntegrationWebhookBodySchema.parse(body);
  try {
    const id = await marketingIntegrationsRepository.insertWebhook(tx, {
      eventKey: input.eventKey,
      url: input.url,
      enabled: input.enabled,
    });
    const row = await marketingIntegrationsRepository.findWebhookById(tx, id);
    if (!row) throw notFound();
    return marketingIntegrationWebhookResponseSchema.parse({ data: toWebhookDto(row) });
  } catch (error) {
    if (
      error instanceof Error &&
      /unique|duplicate/i.test(error.message)
    ) {
      throw validationError("This webhook URL is already registered for that event.");
    }
    throw error;
  }
}

export async function updateMarketingIntegrationWebhook(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  body: unknown,
) {
  const input = updateMarketingIntegrationWebhookBodySchema.parse(body);
  const row = await marketingIntegrationsRepository.updateWebhook(tx, {
    id,
    ...(input.url !== undefined ? { url: input.url } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
  });
  if (!row) throw notFound("Webhook not found.");
  return marketingIntegrationWebhookResponseSchema.parse({ data: toWebhookDto(row) });
}

export async function deleteMarketingIntegrationWebhook(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
) {
  const deleted = await marketingIntegrationsRepository.deleteWebhook(tx, id);
  if (!deleted) throw notFound("Webhook not found.");
  return deleteMarketingIntegrationWebhookResponseSchema.parse({
    data: { id, deleted: true },
  });
}

export async function testMarketingIntegrationWebhook(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
) {
  const row = await marketingIntegrationsRepository.findWebhookById(tx, id);
  if (!row) throw notFound("Webhook not found.");

  const result = await deliverWebhook({
    url: row.url,
    eventKey: row.event_key,
    payload: {
      test: true,
      tenantId: ctx.tenantId,
      webhookId: row.id,
      sample: {
        email: "test@example.com",
        name: "Test Learner",
      },
    },
  });

  await marketingIntegrationsRepository.markWebhookDelivery(tx, {
    id: row.id,
    status: result.ok ? `ok:${result.statusCode ?? 0}` : `error:${result.message.slice(0, 180)}`,
    tested: true,
  });
  await marketingIntegrationsRepository.insertDelivery(tx, {
    webhookId: row.id,
    eventKey: row.event_key,
    url: row.url,
    ok: result.ok,
    statusCode: result.statusCode,
    message: result.message,
    requestBody: JSON.stringify({
      event: row.event_key,
      occurredAt: new Date().toISOString(),
      data: {
        test: true,
        tenantId: ctx.tenantId,
        webhookId: row.id,
        sample: { email: "test@example.com", name: "Test Learner" },
      },
    }),
    source: "test",
  });

  return testMarketingIntegrationWebhookResponseSchema.parse({
    data: {
      id: row.id,
      ok: result.ok,
      statusCode: result.statusCode,
      message: result.message,
    },
  });
}

export async function listMarketingIntegrationWebhookDeliveries(
  tx: TenantTx,
  _ctx: ServiceCtx,
  webhookId: string,
) {
  const webhook = await marketingIntegrationsRepository.findWebhookById(tx, webhookId);
  if (!webhook) throw notFound("Webhook not found.");
  const rows = await marketingIntegrationsRepository.listDeliveries(tx, {
    webhookId,
    limit: 50,
  });
  return marketingIntegrationDeliveriesListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        webhookId: row.webhook_id,
        eventKey: row.event_key as MarketingIntegrationEventKey,
        url: row.url,
        ok: row.ok,
        statusCode: row.status_code,
        message: row.message,
        requestBody: row.request_body,
        source: row.source === "test" ? ("test" as const) : ("dispatch" as const),
        createdAt: row.created_at.toISOString(),
      })),
    },
  });
}

export async function getMarketingIntegrationOverview(tx: TenantTx, _ctx: ServiceCtx) {
  const overview = await marketingIntegrationsRepository.overview(tx);
  const snippetConfiguredCount = [
    overview.site_body_html,
    overview.order_tracking_html,
    overview.signup_tracking_html,
  ].filter((value) => Boolean(value && value.trim())).length;

  let health: "healthy" | "attention" | "idle" = "idle";
  if (overview.webhook_enabled_count > 0) {
    health = overview.webhooks_last_error_count > 0 ? "attention" : "healthy";
  }

  return marketingIntegrationOverviewResponseSchema.parse({
    data: {
      webhookCount: overview.webhook_count,
      webhookEnabledCount: overview.webhook_enabled_count,
      webhooksWithDelivery: overview.webhooks_with_delivery,
      webhooksLastOkCount: overview.webhooks_last_ok_count,
      webhooksLastErrorCount: overview.webhooks_last_error_count,
      snippetConfiguredCount,
      apiKeyConfigured: Boolean(overview.api_key_hash),
      apiKeyCreatedAt: overview.api_key_created_at?.toISOString() ?? null,
      lastDeliveryAt: overview.last_delivery_at?.toISOString() ?? null,
      health,
    },
  });
}

export async function getMarketingIntegrationCredentials(
  tx: TenantTx,
  ctx: ServiceCtx,
) {
  const settings = await marketingIntegrationsRepository.ensureSettings(tx);
  const tenantRows = await tx.$queryRawUnsafe<Array<{ slug: string }>>(
    `select slug from tenants where id = $1::uuid limit 1`,
    ctx.tenantId,
  );
  return marketingIntegrationCredentialsResponseSchema.parse({
    data: {
      schoolId: ctx.tenantId,
      tenantSlug: tenantRows[0]?.slug ?? "",
      apiKeyConfigured: Boolean(settings.api_key_hash),
      apiKeyPrefix: settings.api_key_prefix,
      apiKeyCreatedAt: settings.api_key_created_at?.toISOString() ?? null,
    },
  });
}

export async function rotateMarketingIntegrationApiKey(
  tx: TenantTx,
  ctx: ServiceCtx,
) {
  const { settings, apiKey } = await marketingIntegrationsRepository.rotateApiKey(tx);
  if (!settings?.api_key_prefix || !settings.api_key_created_at) {
    throw validationError("Could not rotate integration API key.");
  }
  const tenantRows = await tx.$queryRawUnsafe<Array<{ slug: string }>>(
    `select slug from tenants where id = $1::uuid limit 1`,
    ctx.tenantId,
  );
  return rotateMarketingIntegrationApiKeyResponseSchema.parse({
    data: {
      schoolId: ctx.tenantId,
      tenantSlug: tenantRows[0]?.slug ?? "",
      apiKey,
      apiKeyPrefix: settings.api_key_prefix,
      apiKeyCreatedAt: settings.api_key_created_at.toISOString(),
    },
  });
}

export async function getPublicMarketingIntegrationSnippets(tx: TenantTx) {
  const settings = await marketingIntegrationsRepository.getSettings(tx);
  return publicMarketingIntegrationSnippetsResponseSchema.parse({
    data: {
      siteBodyHtml: settings?.site_body_html ?? null,
      orderTrackingHtml: settings?.order_tracking_html ?? null,
      signupTrackingHtml: settings?.signup_tracking_html ?? null,
    },
  });
}

export async function requireIntegrationApiKey(
  tx: TenantTx,
  apiKey: string | null | undefined,
) {
  if (!apiKey?.trim()) throw authRequired();
  const settings = await marketingIntegrationsRepository.findSettingsByApiKeyHash(
    tx,
    hashIntegrationApiKey(apiKey.trim()),
  );
  if (!settings) throw authRequired();
  return settings;
}

export async function runIntegrationSignUpAction(
  tx: TenantTx,
  ctx: ServiceCtx,
  body: unknown,
) {
  const input = integrationSignUpBodySchema.parse(body);
  const email = input.email.trim().toLowerCase();

  const principalRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `
    select id::text
    from auth_principals
    where email_normalized = $1
    limit 1
    `,
    email,
  );

  let principalId = principalRows[0]?.id ?? null;
  let created = false;

  if (!principalId) {
    const idRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `
      insert into auth_principals (
        id, supabase_user_id, email, email_normalized, global_status, mfa_enabled
      ) values (
        gen_random_uuid(),
        gen_random_uuid(),
        $1,
        $1,
        'active',
        false
      )
      on conflict (email_normalized) do update
        set updated_at = now()
      returning id::text
      `,
      email,
    );
    principalId = idRows[0]?.id ?? null;
    created = true;
  }

  if (!principalId) throw validationError("Could not resolve auth principal.");

  const membershipResult = await ensureSelfServiceLearnerMembership({
    tx,
    tenantId: ctx.tenantId,
    authPrincipalId: principalId,
    email,
    displayName: input.displayName ?? null,
  });

  if (!membershipResult) {
    throw validationError("Could not create learner membership.");
  }

  if (membershipResult.created) created = true;

  await dispatchMarketingIntegrationWebhooks(tx, ctx, "sign_up", {
    email,
    name: input.displayName ?? null,
    membershipId: membershipResult.membershipId,
    source: "integration_api",
  });

  return integrationSignUpResponseSchema.parse({
    data: {
      created,
      email,
      membershipId: membershipResult.membershipId,
    },
  });
}

export async function runIntegrationPaidEnrollmentAction(
  tx: TenantTx,
  ctx: ServiceCtx,
  body: unknown,
) {
  const input = integrationPaidEnrollmentBodySchema.parse(body);
  const email = input.email.trim().toLowerCase();
  const productTitle = input.productTitle.trim();

  const principalRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `
    select id::text
    from auth_principals
    where email_normalized = $1
    limit 1
    `,
    email,
  );
  const principalId = principalRows[0]?.id;
  if (!principalId) {
    throw validationError("Learner must Sign Up (exist) before Paid Enrollment.");
  }

  const membership = await findMembershipByPrincipal({
    tx,
    tenantId: ctx.tenantId,
    authPrincipalId: principalId,
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw validationError("Learner does not have an active membership.");
  }

  const courses = await tx.$queryRawUnsafe<Array<{ id: string; title: string }>>(
    `
    select id::text, title
    from courses
    where deleted_at is null
      and lower(title) = lower($1)
    order by updated_at desc
    limit 1
    `,
    productTitle,
  );
  const course = courses[0];
  if (!course) throw validationError(`Product not found for title "${productTitle}".`);

  const enrollment = await insertEnrollment({
    tx,
    tenantId: ctx.tenantId,
    courseId: course.id,
    membershipId: membership.id,
    enrolledType: "complimentary",
  });

  if (enrollment.created) {
    await publishEnrollmentCreatedEvent({
      tx,
      ctx: {
        tenantId: ctx.tenantId,
        actorMembershipId: membership.id,
        requestId: ctx.requestId,
      },
      enrollmentId: enrollment.id,
      courseId: course.id,
      membershipId: membership.id,
    });
  }

  await dispatchMarketingIntegrationWebhooks(tx, ctx, "purchase", {
    email,
    productTitle: course.title,
    courseId: course.id,
    membershipId: membership.id,
    enrollmentId: enrollment.id,
    source: "integration_api",
  });

  return integrationPaidEnrollmentResponseSchema.parse({
    data: {
      enrolled: true,
      alreadyEnrolled: !enrollment.created,
      email,
      productTitle: course.title,
      courseId: course.id,
      enrollmentId: enrollment.id,
    },
  });
}

export { dispatchMarketingIntegrationWebhooks } from "./marketing-integrations.dispatch";
