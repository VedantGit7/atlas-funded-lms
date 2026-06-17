import type { TenantTx } from "@atlas/db";
import { UpdateTenantBrandingRequestSchema } from "../schemas/branding";
import { UpdateTenantThemeRequestSchema } from "../schemas/theme";
import { upsertTenantBrandingDraft } from "../repositories/branding.repository";
import { upsertTenantThemeDraft } from "../repositories/theme.repository";
import { mapBranding, mapTheme } from "./branding-read.service";

export async function updateTenantBrandingDraft(tx: TenantTx, rawInput: unknown) {
  const input = UpdateTenantBrandingRequestSchema.parse(rawInput);
  const row = await upsertTenantBrandingDraft(tx, input);
  return { data: mapBranding(row) };
}

export async function updateTenantThemeDraft(tx: TenantTx, rawInput: unknown) {
  const input = UpdateTenantThemeRequestSchema.parse(rawInput);
  const row = await upsertTenantThemeDraft(tx, input);
  return { data: mapTheme(row) };
}
