import type { TenantTx } from "@atlas/db";
import type { UpsertLocaleResourcesBody } from "./locale.dto";
import { localeRepository } from "./locale.repository";
import type { LocaleResourceDto, LocaleResourceRow, ServiceCtx } from "./locale.types";

function mapResourceDto(row: LocaleResourceRow): LocaleResourceDto {
  return {
    locale: row.locale,
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listLocaleResources(tx: TenantTx, ctx: ServiceCtx) {
  const rows = await localeRepository.listResources(tx, ctx.tenantId);
  return { data: rows.map(mapResourceDto) };
}

export async function upsertLocaleResources(
  tx: TenantTx,
  ctx: ServiceCtx,
  locale: string,
  input: UpsertLocaleResourcesBody,
) {
  const updated: LocaleResourceDto[] = [];

  for (const resource of input.resources) {
    const row = await localeRepository.upsertResource(tx, {
      tenantId: ctx.tenantId,
      locale,
      key: resource.key,
      value: resource.value,
    });
    updated.push(mapResourceDto(row));
  }

  return { data: updated };
}
