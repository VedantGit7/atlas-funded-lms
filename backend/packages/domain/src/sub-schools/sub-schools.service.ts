import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  createSubSchoolBodySchema,
  deleteSubSchoolResponseSchema,
  subSchoolListResponseSchema,
  subSchoolResponseSchema,
  updateSubSchoolBodySchema,
} from "./sub-schools.dto";
import {
  duplicateSubSchoolEmail,
  duplicateSubSchoolKey,
  subSchoolNotFound,
} from "./sub-schools.errors";
import { hashSubSchoolPassword } from "./sub-schools.password";
import { subSchoolsRepository, type SubSchoolRow } from "./sub-schools.repository";

function toDto(row: SubSchoolRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    mobileNumber: row.mobile_number,
    email: row.email,
    status: row.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function uniqueConflictMessage(error: unknown): "key" | "email" | "unknown" {
  if (!isUniqueViolation(error)) return "unknown";
  const constraint =
    typeof error === "object" && error !== null && "constraint" in error
      ? String((error as { constraint?: string }).constraint ?? "")
      : "";
  if (constraint.includes("email")) return "email";
  if (constraint.includes("key")) return "key";
  return "unknown";
}

export async function createSubSchool(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = createSubSchoolBodySchema.parse(rawBody);

  const existingKey = await subSchoolsRepository.findSubSchoolByKey(tx, body.key);
  if (existingKey) throw duplicateSubSchoolKey();

  const existingEmail = await subSchoolsRepository.findSubSchoolByEmail(tx, body.email);
  if (existingEmail) throw duplicateSubSchoolEmail();

  const passwordHash = await hashSubSchoolPassword(body.password);

  try {
    const row = await subSchoolsRepository.insertSubSchool(tx, {
      key: body.key,
      name: body.name,
      description: body.description ?? null,
      mobileNumber: body.mobileNumber.trim(),
      email: body.email.trim().toLowerCase(),
      passwordHash,
      status: body.status,
    });
    return subSchoolResponseSchema.parse({ data: toDto(row) });
  } catch (error) {
    const conflict = uniqueConflictMessage(error);
    if (conflict === "email") throw duplicateSubSchoolEmail();
    if (conflict === "key" || isUniqueViolation(error)) throw duplicateSubSchoolKey();
    throw error;
  }
}

export async function listSubSchools(tx: TenantTx, _ctx: ServiceCtx) {
  const rows = await subSchoolsRepository.listSubSchools(tx);
  return subSchoolListResponseSchema.parse({ data: { items: rows.map(toDto) } });
}

export async function getSubSchool(tx: TenantTx, _ctx: ServiceCtx, subSchoolId: string) {
  const row = await subSchoolsRepository.findSubSchoolById(tx, subSchoolId);
  if (!row) throw subSchoolNotFound();
  return subSchoolResponseSchema.parse({ data: toDto(row) });
}

export async function updateSubSchool(
  tx: TenantTx,
  _ctx: ServiceCtx,
  subSchoolId: string,
  rawBody: unknown,
) {
  const body = updateSubSchoolBodySchema.parse(rawBody);

  if (body.email !== undefined) {
    const existingEmail = await subSchoolsRepository.findSubSchoolByEmail(tx, body.email);
    if (existingEmail && existingEmail.id !== subSchoolId) throw duplicateSubSchoolEmail();
  }

  const passwordHash =
    body.password !== undefined ? await hashSubSchoolPassword(body.password) : undefined;

  try {
    const row = await subSchoolsRepository.updateSubSchool(tx, subSchoolId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.mobileNumber !== undefined ? { mobileNumber: body.mobileNumber.trim() } : {}),
      ...(body.email !== undefined ? { email: body.email.trim().toLowerCase() } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    });
    if (!row) throw subSchoolNotFound();
    return subSchoolResponseSchema.parse({ data: toDto(row) });
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    const conflict = uniqueConflictMessage(error);
    if (conflict === "email") throw duplicateSubSchoolEmail();
    throw error;
  }
}

export async function deleteSubSchool(tx: TenantTx, _ctx: ServiceCtx, subSchoolId: string) {
  const deleted = await subSchoolsRepository.deleteSubSchool(tx, subSchoolId);
  if (!deleted) throw subSchoolNotFound();
  return deleteSubSchoolResponseSchema.parse({ data: { deleted: true } });
}
