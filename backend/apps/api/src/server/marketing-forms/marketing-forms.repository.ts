import { randomBytes, scryptSync } from "node:crypto";
import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { z } from "zod";
import type { formFieldSchema } from "./marketing-forms.schemas";

export type FormField = z.infer<typeof formFieldSchema>;

export type MarketingFormRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  kind: string;
  share_token: string;
  google_signup_enabled: boolean;
  button_text: string;
  button_color: string;
  button_text_color: string;
  thank_you_html: string | null;
  redirect_enabled: boolean;
  redirect_url: string | null;
  fields_json: unknown;
  created_by_membership_id: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  submission_count?: bigint | number | null;
};

export type MarketingContactRow = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  password_hash: string | null;
  source_form_id: string | null;
  source: string;
  metadata_json: unknown;
  created_at: Date;
  updated_at: Date;
  submission_count?: bigint | number | null;
  associated_forms_json?: unknown;
};

export type MarketingFormSubmissionRow = {
  id: string;
  form_id: string;
  contact_id: string;
  answers_json: unknown;
  source: string;
  created_at: Date;
  email: string;
  display_name: string | null;
};

export function createShareToken() {
  return randomBytes(18).toString("base64url");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function defaultLeadFields(): FormField[] {
  return [
    {
      id: "email",
      key: "email",
      label: "Email",
      placeholder: "you@example.com",
      fieldType: "email",
      required: true,
      isSystem: true,
      sortOrder: 0,
    },
  ];
}

export function defaultSignupFields(): FormField[] {
  return [
    {
      id: "email",
      key: "email",
      label: "Email",
      placeholder: "you@example.com",
      fieldType: "email",
      required: true,
      isSystem: true,
      sortOrder: 0,
    },
    {
      id: "password",
      key: "password",
      label: "Password",
      placeholder: "Create a password",
      fieldType: "password",
      required: true,
      isSystem: true,
      sortOrder: 1,
    },
  ];
}

export function parseFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  return raw as FormField[];
}

export const marketingFormsRepository = {
  async list(tx: TenantTx, args: { q?: string; status?: string; limit: number }) {
    const q = args.q?.trim() ?? "";
    const status = args.status && args.status !== "ALL" ? args.status : null;
    return tx.$queryRaw<MarketingFormRow[]>`
      select
        f.id::text, f.title, f.description, f.status, f.kind, f.share_token,
        f.google_signup_enabled, f.button_text, f.button_color, f.button_text_color,
        f.thank_you_html, f.redirect_enabled, f.redirect_url, f.fields_json,
        f.created_by_membership_id::text, f.published_at, f.created_at, f.updated_at,
        (
          select count(*)::bigint from marketing_form_submissions s where s.form_id = f.id
        ) as submission_count
      from marketing_forms f
      where (${status}::text is null or f.status = ${status})
        and (${q} = '' or f.title ilike '%' || ${q} || '%' or coalesce(f.description, '') ilike '%' || ${q} || '%')
      order by f.updated_at desc
      limit ${args.limit}
    `;
  },

  async countByStatus(tx: TenantTx) {
    const rows = await tx.$queryRaw<Array<{ status: string; count: bigint }>>`
      select status, count(*)::bigint as count
      from marketing_forms
      group by status
    `;
    const result = {
      liveCount: 0,
      draftCount: 0,
      unpublishedCount: 0,
      totalCount: 0,
    };
    for (const row of rows) {
      const count = Number(row.count);
      result.totalCount += count;
      if (row.status === "LIVE") result.liveCount = count;
      else if (row.status === "DRAFT") result.draftCount = count;
      else if (row.status === "UNPUBLISHED") result.unpublishedCount = count;
    }
    return result;
  },

  async findById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRaw<MarketingFormRow[]>`
      select
        f.id::text, f.title, f.description, f.status, f.kind, f.share_token,
        f.google_signup_enabled, f.button_text, f.button_color, f.button_text_color,
        f.thank_you_html, f.redirect_enabled, f.redirect_url, f.fields_json,
        f.created_by_membership_id::text, f.published_at, f.created_at, f.updated_at,
        (
          select count(*)::bigint from marketing_form_submissions s where s.form_id = f.id
        ) as submission_count
      from marketing_forms f
      where f.id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findByShareToken(tx: TenantTx, token: string) {
    const rows = await tx.$queryRaw<MarketingFormRow[]>`
      select
        f.id::text, f.title, f.description, f.status, f.kind, f.share_token,
        f.google_signup_enabled, f.button_text, f.button_color, f.button_text_color,
        f.thank_you_html, f.redirect_enabled, f.redirect_url, f.fields_json,
        f.created_by_membership_id::text, f.published_at, f.created_at, f.updated_at
      from marketing_forms f
      where f.share_token = ${token}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insert(
    tx: TenantTx,
    args: {
      title: string;
      description: string | null;
      kind: "LEAD" | "SIGNUP";
      fields: FormField[];
      createdByMembershipId: string;
    },
  ) {
    const id = randomUUID();
    const shareToken = createShareToken();
    await tx.$executeRaw`
      insert into marketing_forms (
        id, tenant_id, title, description, status, kind, share_token, fields_json,
        created_by_membership_id, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.title},
        ${args.description},
        'DRAFT',
        ${args.kind},
        ${shareToken},
        ${JSON.stringify(args.fields)}::jsonb,
        ${args.createdByMembershipId}::uuid,
        now(),
        now()
      )
    `;
    return id;
  },

  async updateBasics(
    tx: TenantTx,
    args: {
      id: string;
      title: string;
      description: string | null;
      googleSignupEnabled: boolean;
    },
  ) {
    await tx.$executeRaw`
      update marketing_forms
      set title = ${args.title},
          description = ${args.description},
          google_signup_enabled = ${args.googleSignupEnabled},
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async updateFields(tx: TenantTx, args: { id: string; fields: FormField[] }) {
    await tx.$executeRaw`
      update marketing_forms
      set fields_json = ${JSON.stringify(args.fields)}::jsonb,
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async updateAppearance(
    tx: TenantTx,
    args: {
      id: string;
      buttonText: string;
      buttonColor: string;
      buttonTextColor: string;
      thankYouHtml: string | null;
      redirectEnabled: boolean;
      redirectUrl: string | null;
    },
  ) {
    await tx.$executeRaw`
      update marketing_forms
      set button_text = ${args.buttonText},
          button_color = ${args.buttonColor},
          button_text_color = ${args.buttonTextColor},
          thank_you_html = ${args.thankYouHtml},
          redirect_enabled = ${args.redirectEnabled},
          redirect_url = ${args.redirectUrl},
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async setStatus(tx: TenantTx, id: string, status: "DRAFT" | "LIVE" | "UNPUBLISHED") {
    await tx.$executeRaw`
      update marketing_forms
      set status = ${status},
          published_at = case when ${status} = 'LIVE' then coalesce(published_at, now()) else published_at end,
          updated_at = now()
      where id = ${id}::uuid
    `;
  },

  async deleteById(tx: TenantTx, id: string) {
    await tx.$executeRaw`delete from marketing_form_submissions where form_id = ${id}::uuid`;
    const result = await tx.$executeRaw`delete from marketing_forms where id = ${id}::uuid`;
    return Number(result) > 0;
  },

  async listSubmissions(tx: TenantTx, formId: string, limit = 100) {
    return tx.$queryRaw<MarketingFormSubmissionRow[]>`
      select
        s.id::text, s.form_id::text, s.contact_id::text, s.answers_json, s.source, s.created_at,
        c.email, c.display_name
      from marketing_form_submissions s
      join marketing_contacts c on c.id = s.contact_id
      where s.form_id = ${formId}::uuid
      order by s.created_at desc
      limit ${limit}
    `;
  },

  async listContacts(tx: TenantTx, args: { q?: string; limit: number }) {
    const q = args.q?.trim() ?? "";
    return tx.$queryRaw<MarketingContactRow[]>`
      select
        c.id::text,
        c.email,
        c.display_name,
        c.phone,
        c.password_hash,
        c.source_form_id::text,
        c.source,
        c.metadata_json,
        c.created_at,
        c.updated_at,
        (
          select count(*)::bigint
          from marketing_form_submissions s
          where s.contact_id = c.id
        ) as submission_count,
        (
          select coalesce(
            json_agg(
              json_build_object('id', forms.id, 'title', forms.title)
              order by forms.title
            ),
            '[]'::json
          )
          from (
            select distinct f.id::text as id, f.title
            from marketing_form_submissions s
            inner join marketing_forms f on f.id = s.form_id
            where s.contact_id = c.id
          ) forms
        ) as associated_forms_json
      from marketing_contacts c
      where (${q} = '' or c.email ilike '%' || ${q} || '%' or coalesce(c.display_name, '') ilike '%' || ${q} || '%')
      order by c.updated_at desc
      limit ${args.limit}
    `;
  },

  async countContacts(tx: TenantTx, args: { q?: string } = {}) {
    const q = args.q?.trim() ?? "";
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from marketing_contacts c
      where (${q} = '' or c.email ilike '%' || ${q} || '%' or coalesce(c.display_name, '') ilike '%' || ${q} || '%')
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async findContactByEmail(tx: TenantTx, email: string) {
    const normalized = email.trim().toLowerCase();
    const rows = await tx.$queryRaw<MarketingContactRow[]>`
      select
        id::text, email, display_name, phone, password_hash, source_form_id::text, source,
        metadata_json, created_at, updated_at
      from marketing_contacts
      where lower(email) = ${normalized}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async upsertContact(
    tx: TenantTx,
    args: {
      email: string;
      displayName: string | null;
      phone: string | null;
      passwordHash: string | null;
      sourceFormId: string;
      metadata: Record<string, unknown>;
    },
  ) {
    const existing = await marketingFormsRepository.findContactByEmail(tx, args.email);
    if (existing) {
      await tx.$executeRaw`
        update marketing_contacts
        set display_name = coalesce(${args.displayName}, display_name),
            phone = coalesce(${args.phone}, phone),
            password_hash = coalesce(${args.passwordHash}, password_hash),
            source_form_id = ${args.sourceFormId}::uuid,
            metadata_json = ${JSON.stringify(args.metadata)}::jsonb,
            updated_at = now()
        where id = ${existing.id}::uuid
      `;
      return existing.id;
    }
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_contacts (
        id, tenant_id, email, display_name, phone, password_hash, source_form_id, source,
        metadata_json, created_at, updated_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.email.trim().toLowerCase()},
        ${args.displayName},
        ${args.phone},
        ${args.passwordHash},
        ${args.sourceFormId}::uuid,
        'FORM',
        ${JSON.stringify(args.metadata)}::jsonb,
        now(),
        now()
      )
    `;
    return id;
  },

  async insertSubmission(
    tx: TenantTx,
    args: {
      formId: string;
      contactId: string;
      answers: Record<string, unknown>;
      source: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into marketing_form_submissions (
        id, tenant_id, form_id, contact_id, answers_json, source, created_at
      ) values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.formId}::uuid,
        ${args.contactId}::uuid,
        ${JSON.stringify(args.answers)}::jsonb,
        ${args.source},
        now()
      )
    `;
    return id;
  },

  async findMembershipIdByEmail(tx: TenantTx, email: string) {
    const normalized = email.trim().toLowerCase();
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select m.id::text
      from memberships m
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.status in ('ACTIVE', 'INVITED')
        and (
          lower(coalesce(ap.email, '')) = ${normalized}
          or lower(coalesce(m.invited_email_normalized, '')) = ${normalized}
        )
      order by case when m.status = 'ACTIVE' then 0 else 1 end
      limit 1
    `;
    return rows[0]?.id ?? null;
  },
};
