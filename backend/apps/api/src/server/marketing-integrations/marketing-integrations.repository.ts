import { createHash, randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { MarketingIntegrationEventKey } from "./marketing-integrations.schemas";

export type MarketingIntegrationSettingsRow = {
  tenant_id: string;
  site_body_html: string | null;
  order_tracking_html: string | null;
  signup_tracking_html: string | null;
  api_key_hash: string | null;
  api_key_prefix: string | null;
  api_key_created_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type MarketingIntegrationWebhookRow = {
  id: string;
  event_key: string;
  url: string;
  enabled: boolean;
  last_tested_at: Date | null;
  last_delivery_at: Date | null;
  last_delivery_status: string | null;
  created_at: Date;
  updated_at: Date;
};

export function hashIntegrationApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

export function generateIntegrationApiKey(): { apiKey: string; prefix: string; hash: string } {
  const apiKey = `atk_${randomBytes(24).toString("hex")}`;
  return {
    apiKey,
    prefix: apiKey.slice(0, 10),
    hash: hashIntegrationApiKey(apiKey),
  };
}

export const marketingIntegrationsRepository = {
  async getSettings(tx: TenantTx) {
    const rows = await tx.$queryRawUnsafe<MarketingIntegrationSettingsRow[]>(
      `
      select
        tenant_id::text,
        site_body_html,
        order_tracking_html,
        signup_tracking_html,
        api_key_hash,
        api_key_prefix,
        api_key_created_at,
        created_at,
        updated_at
      from marketing_integration_settings
      where tenant_id = app.current_tenant_id()
      limit 1
      `,
    );
    return rows[0] ?? null;
  },

  async ensureSettings(tx: TenantTx) {
    await tx.$executeRaw`
      insert into marketing_integration_settings (tenant_id)
      values (app.current_tenant_id())
      on conflict (tenant_id) do nothing
    `;
    const settings = await this.getSettings(tx);
    if (!settings) {
      throw new Error("Failed to ensure marketing integration settings.");
    }
    return settings;
  },

  async updateSnippets(
    tx: TenantTx,
    args: {
      siteBodyHtml: string | null | undefined;
      orderTrackingHtml: string | null | undefined;
      signupTrackingHtml: string | null | undefined;
    },
  ) {
    await this.ensureSettings(tx);
    await tx.$executeRaw`
      update marketing_integration_settings
      set
        site_body_html = coalesce(${args.siteBodyHtml ?? null}, site_body_html),
        order_tracking_html = coalesce(${args.orderTrackingHtml ?? null}, order_tracking_html),
        signup_tracking_html = coalesce(${args.signupTrackingHtml ?? null}, signup_tracking_html),
        updated_at = now()
      where tenant_id = app.current_tenant_id()
    `;

    // Explicit null clears: when caller passes null (not undefined), wipe the field.
    if (args.siteBodyHtml === null) {
      await tx.$executeRaw`
        update marketing_integration_settings
        set site_body_html = null, updated_at = now()
        where tenant_id = app.current_tenant_id()
      `;
    }
    if (args.orderTrackingHtml === null) {
      await tx.$executeRaw`
        update marketing_integration_settings
        set order_tracking_html = null, updated_at = now()
        where tenant_id = app.current_tenant_id()
      `;
    }
    if (args.signupTrackingHtml === null) {
      await tx.$executeRaw`
        update marketing_integration_settings
        set signup_tracking_html = null, updated_at = now()
        where tenant_id = app.current_tenant_id()
      `;
    }

    return this.getSettings(tx);
  },

  async rotateApiKey(tx: TenantTx) {
    const generated = generateIntegrationApiKey();
    await this.ensureSettings(tx);
    await tx.$executeRaw`
      update marketing_integration_settings
      set
        api_key_hash = ${generated.hash},
        api_key_prefix = ${generated.prefix},
        api_key_created_at = now(),
        updated_at = now()
      where tenant_id = app.current_tenant_id()
    `;
    const settings = await this.getSettings(tx);
    return { settings, apiKey: generated.apiKey };
  },

  async findSettingsByApiKeyHash(tx: TenantTx, hash: string) {
    const rows = await tx.$queryRawUnsafe<MarketingIntegrationSettingsRow[]>(
      `
      select
        tenant_id::text,
        site_body_html,
        order_tracking_html,
        signup_tracking_html,
        api_key_hash,
        api_key_prefix,
        api_key_created_at,
        created_at,
        updated_at
      from marketing_integration_settings
      where tenant_id = app.current_tenant_id()
        and api_key_hash = $1
      limit 1
      `,
      hash,
    );
    return rows[0] ?? null;
  },

  async listWebhooks(tx: TenantTx) {
    return tx.$queryRawUnsafe<MarketingIntegrationWebhookRow[]>(
      `
      select
        id::text,
        event_key,
        url,
        enabled,
        last_tested_at,
        last_delivery_at,
        last_delivery_status,
        created_at,
        updated_at
      from marketing_integration_webhooks
      order by event_key asc, created_at asc
      `,
    );
  },

  async listEnabledWebhooksForEvent(tx: TenantTx, eventKey: MarketingIntegrationEventKey) {
    return tx.$queryRawUnsafe<MarketingIntegrationWebhookRow[]>(
      `
      select
        id::text,
        event_key,
        url,
        enabled,
        last_tested_at,
        last_delivery_at,
        last_delivery_status,
        created_at,
        updated_at
      from marketing_integration_webhooks
      where event_key = $1
        and enabled = true
      order by created_at asc
      `,
      eventKey,
    );
  },

  async findWebhookById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRawUnsafe<MarketingIntegrationWebhookRow[]>(
      `
      select
        id::text,
        event_key,
        url,
        enabled,
        last_tested_at,
        last_delivery_at,
        last_delivery_status,
        created_at,
        updated_at
      from marketing_integration_webhooks
      where id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },

  async insertWebhook(
    tx: TenantTx,
    args: { eventKey: MarketingIntegrationEventKey; url: string; enabled: boolean },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_integration_webhooks (
        id, tenant_id, event_key, url, enabled
      ) values (
        ${id}::uuid, app.current_tenant_id(), ${args.eventKey}, ${args.url}, ${args.enabled}
      )
    `;
    return id;
  },

  async updateWebhook(tx: TenantTx, args: { id: string; url?: string; enabled?: boolean }) {
    const existing = await this.findWebhookById(tx, args.id);
    if (!existing) return null;
    await tx.$executeRaw`
      update marketing_integration_webhooks
      set
        url = ${args.url ?? existing.url},
        enabled = ${args.enabled ?? existing.enabled},
        updated_at = now()
      where id = ${args.id}::uuid
    `;
    return this.findWebhookById(tx, args.id);
  },

  async deleteWebhook(tx: TenantTx, id: string) {
    await tx.$executeRaw`
      delete from marketing_integration_webhook_deliveries
      where webhook_id = ${id}::uuid
    `;
    const result = await tx.$executeRaw`
      delete from marketing_integration_webhooks
      where id = ${id}::uuid
    `;
    return result > 0;
  },

  async markWebhookDelivery(
    tx: TenantTx,
    args: {
      id: string;
      status: string;
      tested?: boolean;
    },
  ) {
    await tx.$executeRaw`
      update marketing_integration_webhooks
      set
        last_delivery_at = now(),
        last_delivery_status = ${args.status},
        last_tested_at = case when ${args.tested ?? false} then now() else last_tested_at end,
        updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async insertDelivery(
    tx: TenantTx,
    args: {
      webhookId: string;
      eventKey: string;
      url: string;
      ok: boolean;
      statusCode: number | null;
      message: string;
      requestBody: string | null;
      source: "dispatch" | "test";
    },
  ) {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into marketing_integration_webhook_deliveries (
        id, tenant_id, webhook_id, event_key, url, ok, status_code, message, request_body, source
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3, $4, $5, $6, $7, $8, $9
      )
      `,
      id,
      args.webhookId,
      args.eventKey,
      args.url,
      args.ok,
      args.statusCode,
      args.message.slice(0, 2000),
      args.requestBody ? args.requestBody.slice(0, 8000) : null,
      args.source,
    );
    return id;
  },

  async listDeliveries(tx: TenantTx, args: { webhookId: string; limit: number }) {
    return tx.$queryRawUnsafe<
      Array<{
        id: string;
        webhook_id: string;
        event_key: string;
        url: string;
        ok: boolean;
        status_code: number | null;
        message: string;
        request_body: string | null;
        source: string;
        created_at: Date;
      }>
    >(
      `
      select
        id::text,
        webhook_id::text,
        event_key,
        url,
        ok,
        status_code,
        message,
        request_body,
        source,
        created_at
      from marketing_integration_webhook_deliveries
      where webhook_id = $1::uuid
      order by created_at desc
      limit $2
      `,
      args.webhookId,
      args.limit,
    );
  },

  async overview(tx: TenantTx) {
    const rows = await tx.$queryRawUnsafe<
      Array<{
        webhook_count: number;
        webhook_enabled_count: number;
        webhooks_with_delivery: number;
        webhooks_last_ok_count: number;
        webhooks_last_error_count: number;
        last_delivery_at: Date | null;
        site_body_html: string | null;
        order_tracking_html: string | null;
        signup_tracking_html: string | null;
        api_key_hash: string | null;
        api_key_created_at: Date | null;
      }>
    >(
      `
      with hooks as (
        select
          count(*)::int as webhook_count,
          count(*) filter (where enabled)::int as webhook_enabled_count,
          count(*) filter (where last_delivery_status is not null)::int as webhooks_with_delivery,
          count(*) filter (where last_delivery_status like 'ok:%')::int as webhooks_last_ok_count,
          count(*) filter (where last_delivery_status like 'error:%')::int as webhooks_last_error_count,
          max(last_delivery_at) as last_delivery_at
        from marketing_integration_webhooks
      ),
      settings as (
        select
          site_body_html,
          order_tracking_html,
          signup_tracking_html,
          api_key_hash,
          api_key_created_at
        from marketing_integration_settings
        where tenant_id = app.current_tenant_id()
        limit 1
      )
      select
        hooks.*,
        settings.site_body_html,
        settings.order_tracking_html,
        settings.signup_tracking_html,
        settings.api_key_hash,
        settings.api_key_created_at
      from hooks
      left join settings on true
      `,
    );
    return (
      rows[0] ?? {
        webhook_count: 0,
        webhook_enabled_count: 0,
        webhooks_with_delivery: 0,
        webhooks_last_ok_count: 0,
        webhooks_last_error_count: 0,
        last_delivery_at: null,
        site_body_html: null,
        order_tracking_html: null,
        signup_tracking_html: null,
        api_key_hash: null,
        api_key_created_at: null,
      }
    );
  },
};
