export type SystemEmailDto = {
  key: string;
  name: string;
  description: string;
  category: "certificates" | "security";
  enabled: boolean;
  isCustomized: boolean;
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  defaultActionPath: string;
  templateId: string | null;
  updatedAt: string | null;
};

export type SystemEmailVariable = {
  key: string;
  sample: string;
  description: string;
};

export const SYSTEM_EMAIL_LIST_HREF = "/admin/marketing/messenger/system-email";
export const TRANSACTIONAL_EMAIL_SETTINGS_HREF = "/admin/channels/transactional-email";

export function systemEmailHref(key: string) {
  return `/admin/marketing/messenger/system-email/${encodeURIComponent(key)}`;
}

export function formatSystemEmailDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatSystemEmailCategory(
  category: SystemEmailDto["category"],
): string {
  return category === "certificates" ? "Certificates" : "Security";
}

export function renderSystemEmailPreview(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_match, name: string) => {
    return variables[name] ?? "";
  });
}

export function sampleMapFromVariables(
  variables: ReadonlyArray<SystemEmailVariable>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const variable of variables) {
    result[variable.key] = variable.sample;
  }
  return result;
}
