import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { outbox } from "@atlas/events";
import {
  createMarketingFormBodySchema,
  deleteMarketingFormBodySchema,
  deleteMarketingFormResponseSchema,
  formFieldSchema,
  marketingContactsListQuerySchema,
  marketingContactsListResponseSchema,
  marketingFormResponseSchema,
  marketingFormSubmissionsResponseSchema,
  marketingFormsListQuerySchema,
  marketingFormsListResponseSchema,
  publicMarketingFormResponseSchema,
  publicSubmitFormBodySchema,
  publicSubmitFormResponseSchema,
  updateMarketingFormAppearanceBodySchema,
  updateMarketingFormBasicsBodySchema,
  updateMarketingFormFieldsBodySchema,
} from "./marketing-forms.schemas";
import {
  defaultLeadFields,
  defaultSignupFields,
  hashPassword,
  marketingFormsRepository,
  parseFields,
  type FormField,
  type MarketingFormRow,
} from "./marketing-forms.repository";

function notFound(message = "Form not found.") {
  return new AtlasHttpError({ code: "PERMISSION_DENIED", status: 404, message });
}

function validationError(message: string) {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

function sharePath(token: string) {
  return `/f/${token}`;
}

function toDto(row: MarketingFormRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as "DRAFT" | "LIVE" | "UNPUBLISHED",
    kind: row.kind as "LEAD" | "SIGNUP",
    shareToken: row.share_token,
    sharePath: sharePath(row.share_token),
    googleSignupEnabled: row.google_signup_enabled,
    buttonText: row.button_text,
    buttonColor: row.button_color,
    buttonTextColor: row.button_text_color,
    thankYouHtml: row.thank_you_html,
    redirectEnabled: row.redirect_enabled,
    redirectUrl: row.redirect_url,
    fields: parseFields(row.fields_json).map((field) => formFieldSchema.parse(field)),
    submissionCount: Number(row.submission_count ?? 0),
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function requireForm(tx: TenantTx, id: string) {
  const row = await marketingFormsRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

function assertEditable(row: MarketingFormRow) {
  if (row.status === "LIVE") {
    throw validationError("Unpublish the form before editing fields or appearance.");
  }
}

function ensureSystemFields(kind: "LEAD" | "SIGNUP", fields: FormField[]): FormField[] {
  const defaults = kind === "SIGNUP" ? defaultSignupFields() : defaultLeadFields();
  const byKey = new Map(fields.map((field) => [field.key, field]));
  for (const system of defaults) {
    const existing = byKey.get(system.key);
    byKey.set(system.key, {
      ...system,
      ...(existing
        ? {
            label: existing.label || system.label,
            placeholder: existing.placeholder ?? system.placeholder,
            sortOrder: existing.sortOrder,
          }
        : {}),
      required: true,
      isSystem: true,
      fieldType: system.fieldType,
    });
  }
  return [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listMarketingForms(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = marketingFormsListQuerySchema.parse(rawQuery ?? {});
  const [rows, summary] = await Promise.all([
    marketingFormsRepository.list(tx, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
    }),
    marketingFormsRepository.countByStatus(tx),
  ]);
  return marketingFormsListResponseSchema.parse({
    data: {
      items: rows.map(toDto),
      summary,
    },
  });
}

export async function getMarketingForm(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  return marketingFormResponseSchema.parse({ data: toDto(await requireForm(tx, id)) });
}

export async function createMarketingForm(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createMarketingFormBodySchema.parse(rawBody);
  const kind = body.kind ?? "LEAD";
  const id = await marketingFormsRepository.insert(tx, {
    title: body.title,
    description: body.description ?? null,
    kind,
    fields: kind === "SIGNUP" ? defaultSignupFields() : defaultLeadFields(),
    createdByMembershipId: ctx.actorMembershipId,
  });
  return marketingFormResponseSchema.parse({ data: toDto(await requireForm(tx, id)) });
}

export async function updateMarketingFormBasics(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingFormBasicsBodySchema.parse(rawBody);
  const existing = await requireForm(tx, id);
  await marketingFormsRepository.updateBasics(tx, {
    id,
    title: body.title,
    description: body.description ?? null,
    googleSignupEnabled:
      existing.kind === "SIGNUP"
        ? (body.googleSignupEnabled ?? existing.google_signup_enabled)
        : false,
  });
  return marketingFormResponseSchema.parse({ data: toDto(await requireForm(tx, id)) });
}

export async function updateMarketingFormFields(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingFormFieldsBodySchema.parse(rawBody);
  const existing = await requireForm(tx, id);
  assertEditable(existing);
  const fields = ensureSystemFields(existing.kind as "LEAD" | "SIGNUP", body.fields);
  await marketingFormsRepository.updateFields(tx, { id, fields });
  return marketingFormResponseSchema.parse({ data: toDto(await requireForm(tx, id)) });
}

export async function updateMarketingFormAppearance(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingFormAppearanceBodySchema.parse(rawBody);
  const existing = await requireForm(tx, id);
  assertEditable(existing);
  await marketingFormsRepository.updateAppearance(tx, {
    id,
    buttonText: body.buttonText,
    buttonColor: body.buttonColor,
    buttonTextColor: body.buttonTextColor,
    thankYouHtml: body.thankYouHtml ?? null,
    redirectEnabled: body.redirectEnabled,
    redirectUrl: body.redirectEnabled ? (body.redirectUrl ?? null) : null,
  });
  return marketingFormResponseSchema.parse({ data: toDto(await requireForm(tx, id)) });
}

export async function publishMarketingForm(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const existing = await requireForm(tx, id);
  const fields = parseFields(existing.fields_json);
  if (!fields.some((field) => field.key === "email")) {
    throw validationError("Form must include an email field.");
  }
  await marketingFormsRepository.setStatus(tx, id, "LIVE");
  return marketingFormResponseSchema.parse({ data: toDto(await requireForm(tx, id)) });
}

export async function unpublishMarketingForm(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  await requireForm(tx, id);
  await marketingFormsRepository.setStatus(tx, id, "UNPUBLISHED");
  return marketingFormResponseSchema.parse({ data: toDto(await requireForm(tx, id)) });
}

export async function deleteMarketingForm(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deleteMarketingFormBodySchema.parse(rawBody);
  const existing = await requireForm(tx, id);
  if (existing.title.trim() !== body.titleConfirmation.trim()) {
    throw validationError("Title confirmation does not match.");
  }
  if (existing.status === "LIVE") {
    throw validationError("Unpublish the form before deleting it.");
  }
  const deleted = await marketingFormsRepository.deleteById(tx, id);
  if (!deleted) throw notFound();
  return deleteMarketingFormResponseSchema.parse({ data: { id, deleted: true as const } });
}

export async function listMarketingFormSubmissions(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  await requireForm(tx, id);
  const rows = await marketingFormsRepository.listSubmissions(tx, id);
  return marketingFormSubmissionsResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        formId: row.form_id,
        contactId: row.contact_id,
        email: row.email,
        displayName: row.display_name,
        answers: (row.answers_json ?? {}) as Record<string, unknown>,
        source: row.source,
        createdAt: row.created_at.toISOString(),
      })),
    },
  });
}

export async function listMarketingContacts(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = marketingContactsListQuerySchema.parse(rawQuery ?? {});
  const listArgs = {
    ...(query.q ? { q: query.q } : {}),
    limit: query.limit,
  };
  const [rows, totalCount] = await Promise.all([
    marketingFormsRepository.listContacts(tx, listArgs),
    marketingFormsRepository.countContacts(tx, query.q ? { q: query.q } : {}),
  ]);
  return marketingContactsListResponseSchema.parse({
    data: {
      items: rows.map((row) => {
        const associatedRaw = row.associated_forms_json;
        const associatedForms = Array.isArray(associatedRaw)
          ? associatedRaw
              .map((entry) => {
                if (!entry || typeof entry !== "object") return null;
                const record = entry as Record<string, unknown>;
                const id = typeof record["id"] === "string" ? record["id"] : null;
                const title = typeof record["title"] === "string" ? record["title"] : null;
                if (!id || !title) return null;
                return { id, title };
              })
              .filter((entry): entry is { id: string; title: string } => entry != null)
          : [];
        return {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          phone: row.phone,
          sourceFormId: row.source_form_id,
          source: row.source,
          submissionCount: Number(row.submission_count ?? 0),
          associatedForms,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        };
      }),
      summary: { totalCount },
    },
  });
}

export async function getPublicMarketingForm(tx: TenantTx, token: string) {
  const row = await marketingFormsRepository.findByShareToken(tx, token);
  if (!row || row.status !== "LIVE") throw notFound("Form is not available.");
  const dto = toDto(row);
  return publicMarketingFormResponseSchema.parse({
    data: {
      title: dto.title,
      description: dto.description,
      kind: dto.kind,
      googleSignupEnabled: dto.googleSignupEnabled,
      buttonText: dto.buttonText,
      buttonColor: dto.buttonColor,
      buttonTextColor: dto.buttonTextColor,
      fields: dto.fields.map(({ isSystem: _isSystem, ...field }) => field),
    },
  });
}

export async function submitPublicMarketingForm(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string },
  token: string,
  rawBody: unknown,
) {
  const body = publicSubmitFormBodySchema.parse(rawBody ?? {});
  const form = await marketingFormsRepository.findByShareToken(tx, token);
  if (!form || form.status !== "LIVE") throw notFound("Form is not available.");

  const fields = parseFields(form.fields_json);
  const answers: Record<string, unknown> = {};
  for (const field of fields) {
    const value = body.answers[field.key];
    if (field.required && (value == null || String(value).trim() === "")) {
      throw validationError(`${field.label} is required.`);
    }
    if (value != null) answers[field.key] = value;
  }

  const emailRaw = answers["email"];
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) throw validationError("A valid email is required.");

  let passwordHash: string | null = null;
  if (form.kind === "SIGNUP") {
    const password = answers["password"];
    if (typeof password !== "string" || password.length < 8) {
      throw validationError("Password must be at least 8 characters.");
    }
    passwordHash = hashPassword(password);
    delete answers["password"];
  }

  const displayName =
    (typeof answers["name"] === "string" && answers["name"]) ||
    (typeof answers["full_name"] === "string" && answers["full_name"]) ||
    (typeof answers["first_name"] === "string" && answers["first_name"]) ||
    null;
  const phone = typeof answers["phone"] === "string" ? answers["phone"] : null;

  const contactId = await marketingFormsRepository.upsertContact(tx, {
    email,
    displayName,
    phone,
    passwordHash,
    sourceFormId: form.id,
    metadata: { lastAnswers: answers, kind: form.kind },
  });

  const submissionId = await marketingFormsRepository.insertSubmission(tx, {
    formId: form.id,
    contactId,
    answers,
    source: body.source,
  });

  const membershipId = await marketingFormsRepository.findMembershipIdByEmail(tx, email);

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: membershipId,
      requestId: ctx.requestId,
    },
    eventType: "marketing.form_submitted",
    aggregateType: "marketing_form",
    aggregateId: form.id,
    payload: {
      formId: form.id,
      formTitle: form.title,
      submissionId,
      contactId,
      contactEmail: email,
      membershipId,
      answers,
      source: body.source,
    },
    idempotencyKey: `marketing.form_submitted:${submissionId}`,
  });

  return publicSubmitFormResponseSchema.parse({
    data: {
      submitted: true as const,
      thankYouHtml: form.thank_you_html,
      redirectUrl: form.redirect_enabled ? form.redirect_url : null,
    },
  });
}
