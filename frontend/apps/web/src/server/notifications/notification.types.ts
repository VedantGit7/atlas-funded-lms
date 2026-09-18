// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export type NotificationTemplateRow = {
  id: string;
  tenant_id: string;
  key: string;
  channel: string;
  locale: string;
  subject: string | null;
  body: string;
  variables_json: unknown;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type NotificationDispatchRow = {
  id: string;
  tenant_id: string;
  membership_id: string | null;
  channel: string;
  template_key: string | null;
  destination: string | null;
  idempotency_key: string;
  status: string;
  payload_json: unknown;
  error_json: unknown;
  created_at: Date;
  sent_at: Date | null;
};

export type NotificationInboxPayload = {
  inbox: {
    title: string;
    body: string;
    actionPath: string;
    readAt?: string | null;
  };
};
