import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  createCustomFieldDefinitionBodySchema,
  customFieldDefinitionListResponseSchema,
  customFieldDefinitionResponseSchema,
  customFieldValueListResponseSchema,
  customFieldValueResponseSchema,
  setCustomFieldValueBodySchema,
  updateCustomFieldDefinitionBodySchema,
} from "./custom-fields.dto";
import { customFieldDefinitionNotFound } from "./custom-fields.errors";
import { customFieldsRepository, type CustomFieldDefinitionRow } from "./custom-fields.repository";

function toDefinitionDto(row: CustomFieldDefinitionRow) {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    fieldType: row.field_type,
    status: row.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
    createdAt: row.created_at.toISOString(),
  };
}

export async function createCustomFieldDefinition(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = createCustomFieldDefinitionBodySchema.parse(rawBody);
  const row = await customFieldsRepository.insertDefinition(tx, {
    key: body.key,
    label: body.label,
    fieldType: body.fieldType,
    optionsJson: body.optionsJson,
    status: body.status,
  });
  return customFieldDefinitionResponseSchema.parse({ data: toDefinitionDto(row) });
}

export async function listCustomFieldDefinitions(tx: TenantTx, _ctx: ServiceCtx) {
  const rows = await customFieldsRepository.listDefinitions(tx);
  return customFieldDefinitionListResponseSchema.parse({
    data: { items: rows.map(toDefinitionDto) },
  });
}

export async function updateCustomFieldDefinition(
  tx: TenantTx,
  _ctx: ServiceCtx,
  definitionId: string,
  rawBody: unknown,
) {
  const body = updateCustomFieldDefinitionBodySchema.parse(rawBody);
  const row = await customFieldsRepository.updateDefinition(tx, definitionId, {
    ...(body.label !== undefined ? { label: body.label } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.optionsJson !== undefined ? { optionsJson: body.optionsJson } : {}),
  });
  if (!row) throw customFieldDefinitionNotFound();
  return customFieldDefinitionResponseSchema.parse({ data: toDefinitionDto(row) });
}

export async function deleteCustomFieldDefinition(
  tx: TenantTx,
  _ctx: ServiceCtx,
  definitionId: string,
) {
  const deleted = await customFieldsRepository.deleteDefinition(tx, definitionId);
  if (!deleted) throw customFieldDefinitionNotFound();
  return { data: { deleted: true } };
}

export async function setCustomFieldValue(
  tx: TenantTx,
  _ctx: ServiceCtx,
  definitionId: string,
  rawBody: unknown,
) {
  const body = setCustomFieldValueBodySchema.parse(rawBody);
  const definition = await customFieldsRepository.findDefinitionById(tx, definitionId);
  if (!definition) throw customFieldDefinitionNotFound();

  const row = await customFieldsRepository.upsertValue(tx, {
    definitionId,
    membershipId: body.membershipId,
    valueJson: body.valueJson,
    updatedByMembershipId: _ctx.actorMembershipId,
  });

  return customFieldValueResponseSchema.parse({
    data: {
      definitionId: row.custom_field_definition_id,
      membershipId: row.membership_id,
      valueJson: row.value_json,
      updatedAt: row.updated_at.toISOString(),
    },
  });
}

export async function listCustomFieldValues(tx: TenantTx, _ctx: ServiceCtx, definitionId: string) {
  const definition = await customFieldsRepository.findDefinitionById(tx, definitionId);
  if (!definition) throw customFieldDefinitionNotFound();

  const rows = await customFieldsRepository.listValuesForDefinition(tx, definitionId);
  return customFieldValueListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        definitionId: row.custom_field_definition_id,
        membershipId: row.membership_id,
        valueJson: row.value_json,
        updatedAt: row.updated_at.toISOString(),
      })),
    },
  });
}
