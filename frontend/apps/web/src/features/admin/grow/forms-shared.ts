export type FormStatus = "DRAFT" | "LIVE" | "UNPUBLISHED";
export type FormKind = "LEAD" | "SIGNUP";
export type FormFieldType = "email" | "password" | "text" | "textarea" | "phone" | "number";

export type FormField = {
  id: string;
  key: string;
  label: string;
  placeholder?: string | null;
  fieldType: FormFieldType;
  required: boolean;
  isSystem?: boolean;
  sortOrder: number;
};

export type FormDto = {
  id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  kind: FormKind;
  shareToken: string;
  sharePath: string;
  googleSignupEnabled: boolean;
  buttonText: string;
  buttonColor: string;
  buttonTextColor: string;
  thankYouHtml: string | null;
  redirectEnabled: boolean;
  redirectUrl: string | null;
  fields: FormField[];
  submissionCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FormListSummary = {
  liveCount: number;
  draftCount: number;
  unpublishedCount: number;
  totalCount: number;
};

export type FormSubmissionDto = {
  id: string;
  formId: string;
  contactId: string;
  email: string;
  displayName: string | null;
  answers: Record<string, unknown>;
  source: string;
  createdAt: string;
};

export type ContactAssociatedForm = {
  id: string;
  title: string;
};

export type ContactDto = {
  id: string;
  email: string;
  displayName: string | null;
  phone: string | null;
  sourceFormId: string | null;
  source: string;
  submissionCount: number;
  associatedForms: ContactAssociatedForm[];
  createdAt: string;
  updatedAt: string;
};

export type ContactsListSummary = {
  totalCount: number;
};

export const FORM_FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "password", label: "Password" },
] as const;

export function formFieldTypeLabel(fieldType: FormFieldType): string {
  return (
    FORM_FIELD_TYPE_OPTIONS.find((option) => option.value === fieldType)?.label ??
    fieldType.replaceAll("_", " ")
  );
}

export function formSubmissionSourceLabel(source: string): string {
  if (source === "LINK") return "Share link";
  if (source === "WEBSITE") return "Website";
  if (source === "CTA") return "CTA";
  if (source === "FORM") return "Form";
  return source.replaceAll("_", " ");
}

export function answerDisplayValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

export const FORMS_LIST_HREF = "/admin/marketing/forms";
export const FORMS_CREATE_HREF = "/admin/marketing/forms/create";
export const CONTACTS_HREF = "/admin/marketing/forms/contacts";
export const MARKETING_HREF = "/admin/marketing";

export function formHref(id: string) {
  return `/admin/marketing/forms/${id}`;
}

export function formSubmissionsHref(id: string) {
  return `/admin/marketing/forms/${id}/submissions`;
}

export function formStatusLabel(status: FormStatus): string {
  if (status === "LIVE") return "Live";
  if (status === "DRAFT") return "Draft";
  return "Unpublished";
}

export function formKindLabel(kind: FormKind): string {
  if (kind === "SIGNUP") return "Sign-up";
  return "Lead";
}

export function formatFormCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

export function formatFormDateTime(value: string | null | undefined): string {
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

export function formatFormRelativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const deltaMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (deltaMs < minute) return "Just now";
  if (deltaMs < hour) {
    const mins = Math.max(1, Math.floor(deltaMs / minute));
    return mins === 1 ? "1 min ago" : `${String(mins)} mins ago`;
  }
  if (deltaMs < day) {
    const hours = Math.max(1, Math.floor(deltaMs / hour));
    return hours === 1 ? "1 hour ago" : `${String(hours)} hours ago`;
  }
  if (deltaMs < 2 * day) return "Yesterday";
  if (deltaMs < 7 * day) {
    const days = Math.floor(deltaMs / day);
    return `${String(days)} days ago`;
  }
  return formatFormDateTime(value);
}

export function formShareSubtitle(form: Pick<FormDto, "status" | "sharePath">): string {
  if (form.status === "LIVE") return form.sharePath;
  if (form.status === "UNPUBLISHED") return "Unpublished - public link paused";
  return "Draft - No public link";
}

export function newField(sortOrder: number, fieldType: FormFieldType = "text"): FormField {
  const order = String(sortOrder);
  const id = `field_${String(Date.now())}_${order}`;
  return {
    id,
    key: `field_${order}`,
    label: "New field",
    placeholder: "",
    fieldType,
    required: false,
    isSystem: false,
    sortOrder,
  };
}
