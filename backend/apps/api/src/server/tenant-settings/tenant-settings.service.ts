import type { TenantTx } from "@atlas/db";
import type { TenantSeoSettings, VideoQuality } from "./tenant-settings.contract";

export async function readTenantDefaultTimezone(tx: TenantTx): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ default_timezone: string }>>`
    select default_timezone
    from tenants
    limit 1
  `;

  return rows[0]?.default_timezone ?? "UTC";
}

export async function updateTenantDefaultTimezone(
  tx: TenantTx,
  timezone: string,
): Promise<{ timezone: string }> {
  await tx.$executeRaw`
    update tenants
    set default_timezone = ${timezone},
        updated_at = now()
  `;

  return { timezone };
}

const DEFAULT_VIDEO_QUALITY: VideoQuality = "low";

function isVideoQuality(value: unknown): value is VideoQuality {
  return value === "high" || value === "medium" || value === "low" || value === "auto";
}

function readMediaSection(configJson: unknown): Record<string, unknown> {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return {};
  }
  const media = (configJson as Record<string, unknown>)["media"];
  if (!media || typeof media !== "object" || Array.isArray(media)) {
    return {};
  }
  return media as Record<string, unknown>;
}

export async function readTenantDefaultVideoQuality(tx: TenantTx): Promise<VideoQuality> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;

  const quality = readMediaSection(rows[0]?.config_json)["defaultVideoQuality"];
  return isVideoQuality(quality) ? quality : DEFAULT_VIDEO_QUALITY;
}

export async function updateTenantDefaultVideoQuality(
  tx: TenantTx,
  quality: VideoQuality,
): Promise<{ quality: VideoQuality }> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;

  const existing =
    rows[0]?.config_json &&
    typeof rows[0].config_json === "object" &&
    !Array.isArray(rows[0].config_json)
      ? (rows[0].config_json as Record<string, unknown>)
      : {};

  const media = readMediaSection(existing);
  const nextConfig = {
    ...existing,
    media: {
      ...media,
      defaultVideoQuality: quality,
    },
  };

  await tx.$executeRaw`
    insert into tenant_config (
      id,
      tenant_id,
      config_json,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      app.current_tenant_id(),
      ${JSON.stringify(nextConfig)}::jsonb,
      now(),
      now()
    )
    on conflict (tenant_id) do update set
      config_json = excluded.config_json,
      updated_at = now()
  `;

  return { quality };
}

function readConfigRoot(configJson: unknown): Record<string, unknown> {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return {};
  }
  return configJson as Record<string, unknown>;
}

function readConfigSection(configJson: unknown, sectionKey: string): Record<string, unknown> {
  const section = readConfigRoot(configJson)[sectionKey];
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return {};
  }
  return section as Record<string, unknown>;
}

async function readTenantConfigRoot(tx: TenantTx): Promise<Record<string, unknown>> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;
  return readConfigRoot(rows[0]?.config_json);
}

async function writeTenantConfigRoot(
  tx: TenantTx,
  configJson: Record<string, unknown>,
): Promise<void> {
  await tx.$executeRaw`
    insert into tenant_config (
      id,
      tenant_id,
      config_json,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      app.current_tenant_id(),
      ${JSON.stringify(configJson)}::jsonb,
      now(),
      now()
    )
    on conflict (tenant_id) do update set
      config_json = excluded.config_json,
      updated_at = now()
  `;
}

function readStringField(section: Record<string, unknown>, key: string): string {
  return typeof section[key] === "string" ? section[key] : "";
}

function readNullableUuid(section: Record<string, unknown>, key: string): string | null {
  const value = section[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function readTenantFastCheckout(tx: TenantTx): Promise<{ enabled: boolean }> {
  const commerce = readConfigSection(await readTenantConfigRoot(tx), "commerce");
  return { enabled: commerce["fastCheckoutEnabled"] === true };
}

export async function updateTenantFastCheckout(
  tx: TenantTx,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  const existing = await readTenantConfigRoot(tx);
  const commerce = readConfigSection(existing, "commerce");
  const nextConfig = {
    ...existing,
    commerce: {
      ...commerce,
      fastCheckoutEnabled: enabled,
    },
  };

  await writeTenantConfigRoot(tx, nextConfig);
  return { enabled };
}

function readIntField(section: Record<string, unknown>, key: string, fallback: number): number {
  const value = section[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function readBoolField(section: Record<string, unknown>, key: string): boolean {
  return section[key] === true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function mergeConfigSection(
  tx: TenantTx,
  sectionKey: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const existing = await readTenantConfigRoot(tx);
  const section = readConfigSection(existing, sectionKey);
  await writeTenantConfigRoot(tx, {
    ...existing,
    [sectionKey]: { ...section, ...patch },
  });
}

export async function readTenantLearnerEmailVerification(
  tx: TenantTx,
): Promise<{ verificationDays: number }> {
  const security = readConfigSection(await readTenantConfigRoot(tx), "security");
  return {
    verificationDays: clamp(readIntField(security, "learnerEmailVerificationDays", 1), 0, 365),
  };
}

export async function updateTenantLearnerEmailVerification(
  tx: TenantTx,
  verificationDays: number,
): Promise<{ verificationDays: number }> {
  const value = clamp(Math.trunc(verificationDays), 0, 365);
  await mergeConfigSection(tx, "security", { learnerEmailVerificationDays: value });
  return { verificationDays: value };
}

export async function readTenantAdminOtp(
  tx: TenantTx,
): Promise<{ enabled: boolean; loginLimitPerMonth: number }> {
  const security = readConfigSection(await readTenantConfigRoot(tx), "security");
  return {
    enabled: readBoolField(security, "adminOtpEnabled"),
    loginLimitPerMonth: clamp(readIntField(security, "adminOtpLoginLimitPerMonth", 1), 0, 1000),
  };
}

export async function updateTenantAdminOtp(
  tx: TenantTx,
  input: { enabled: boolean; loginLimitPerMonth: number },
): Promise<{ enabled: boolean; loginLimitPerMonth: number }> {
  const loginLimitPerMonth = clamp(Math.trunc(input.loginLimitPerMonth), 0, 1000);
  await mergeConfigSection(tx, "security", {
    adminOtpEnabled: input.enabled,
    adminOtpLoginLimitPerMonth: loginLimitPerMonth,
  });
  return { enabled: input.enabled, loginLimitPerMonth };
}

export async function readTenantDeviceMonitor(tx: TenantTx): Promise<{
  restrictionsEnabled: boolean;
  registrationLimit: number;
  restrictParallelLogins: boolean;
}> {
  const security = readConfigSection(await readTenantConfigRoot(tx), "security");
  return {
    restrictionsEnabled: readBoolField(security, "deviceRestrictionsEnabled"),
    registrationLimit: clamp(readIntField(security, "deviceRegistrationLimit", 1), 1, 10),
    restrictParallelLogins: readBoolField(security, "restrictParallelLogins"),
  };
}

export async function updateTenantDeviceMonitor(
  tx: TenantTx,
  input: {
    restrictionsEnabled: boolean;
    registrationLimit: number;
    restrictParallelLogins: boolean;
  },
): Promise<{
  restrictionsEnabled: boolean;
  registrationLimit: number;
  restrictParallelLogins: boolean;
}> {
  const registrationLimit = clamp(Math.trunc(input.registrationLimit), 1, 10);
  await mergeConfigSection(tx, "security", {
    deviceRestrictionsEnabled: input.restrictionsEnabled,
    deviceRegistrationLimit: registrationLimit,
    restrictParallelLogins: input.restrictParallelLogins,
  });
  return {
    restrictionsEnabled: input.restrictionsEnabled,
    registrationLimit,
    restrictParallelLogins: input.restrictParallelLogins,
  };
}

type EmailChannel = { fromName: string; fromEmail: string; replyToEmail: string | null };

export async function readTenantEmailChannel(
  tx: TenantTx,
  channelKey: "transactionalEmail" | "marketingEmail" | "supportEmail",
): Promise<EmailChannel> {
  const channels = readConfigSection(await readTenantConfigRoot(tx), "channels");
  const channel = readConfigSection(channels, channelKey);
  return {
    fromName: readStringField(channel, "fromName"),
    fromEmail: readStringField(channel, "fromEmail"),
    replyToEmail: readStringField(channel, "replyToEmail") || null,
  };
}

export async function updateTenantEmailChannel(
  tx: TenantTx,
  channelKey: "transactionalEmail" | "marketingEmail" | "supportEmail",
  input: EmailChannel,
): Promise<EmailChannel> {
  const existing = await readTenantConfigRoot(tx);
  const channels = readConfigSection(existing, "channels");
  const nextConfig = {
    ...existing,
    channels: {
      ...channels,
      [channelKey]: {
        fromName: input.fromName,
        fromEmail: input.fromEmail,
        replyToEmail: input.replyToEmail,
      },
    },
  };
  await writeTenantConfigRoot(tx, nextConfig);
  return input;
}

export async function readTenantSeoSettings(tx: TenantTx): Promise<TenantSeoSettings> {
  const seo = readConfigSection(await readTenantConfigRoot(tx), "seo");
  return {
    metaDescription: readStringField(seo, "metaDescription"),
    metaKeywords: readStringField(seo, "metaKeywords"),
    metaImageRefId: readNullableUuid(seo, "metaImageRefId"),
  };
}

export async function updateTenantSeoSettings(
  tx: TenantTx,
  input: TenantSeoSettings,
): Promise<TenantSeoSettings> {
  const existing = await readTenantConfigRoot(tx);
  const seo = readConfigSection(existing, "seo");
  const nextConfig = {
    ...existing,
    seo: {
      ...seo,
      metaDescription: input.metaDescription,
      metaKeywords: input.metaKeywords,
      metaImageRefId: input.metaImageRefId,
    },
  };

  await writeTenantConfigRoot(tx, nextConfig);
  return input;
}
