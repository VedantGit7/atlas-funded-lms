export type WhatsappCampaignStatus = "DRAFT" | "SCHEDULED" | "SENT";
export type WhatsappAudienceType = "ALL" | "GROUP";
export type WhatsappTemplateStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
export type WhatsappHeaderType = "NONE" | "TEXT" | "IMAGE";

export type ConnectionDto = {
  status: "DISCONNECTED" | "CONNECTED";
  providerMode: "mock" | "meta";
  displayName: string | null;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  accessTokenLast4: string | null;
  qualityRating: string | null;
  messagingLimit: number;
  connectedAt: string | null;
  hasCredentials: boolean;
};

export type TemplateButton = {
  type: "QUICK_REPLY" | "URL";
  text: string;
  url?: string;
};

export type TemplateDto = {
  id: string;
  name: string;
  category: string;
  language: string;
  headerType: WhatsappHeaderType;
  headerText: string | null;
  headerImageUrl: string | null;
  body: string;
  footer: string | null;
  buttons: TemplateButton[];
  status: WhatsappTemplateStatus;
  metaTemplateId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignDto = {
  id: string;
  title: string;
  status: WhatsappCampaignStatus;
  audienceType: WhatsappAudienceType | null;
  audienceBatchId: string | null;
  audienceLabel: string | null;
  templateId: string | null;
  templateName: string | null;
  templateBody: string | null;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Recipient = {
  membershipId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
};

export type ConversationDto = {
  id: string;
  waPhone: string;
  membershipId: string | null;
  learnerName: string | null;
  lastMessageAt: string;
  unreadCount: number;
  lastMessagePreview: string | null;
};

export type InboxMessage = {
  id: string;
  direction: "IN" | "OUT";
  body: string;
  status: string;
  createdAt: string;
};

export type WizardStep = "title" | "audience" | "recipients" | "template" | "delivery" | "settings";

export const WHATSAPP_LIST_HREF = "/admin/marketing/messenger/whatsapp";
export const WHATSAPP_CREATE_HREF = "/admin/marketing/messenger/whatsapp/create";
export const WHATSAPP_TEMPLATES_HREF = "/admin/marketing/messenger/whatsapp/templates";
export const WHATSAPP_INBOX_HREF = "/admin/marketing/messenger/whatsapp/inbox";

export function whatsappCampaignHref(id: string) {
  return `/admin/marketing/messenger/whatsapp/${id}`;
}

export function formatWhatsappDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function resolveWizardStep(campaign: CampaignDto | null): WizardStep {
  if (!campaign) return "title";
  if (campaign.status === "SENT") return "settings";
  if (!campaign.audienceType) return "audience";
  if (!campaign.templateId) return "recipients";
  return "delivery";
}
