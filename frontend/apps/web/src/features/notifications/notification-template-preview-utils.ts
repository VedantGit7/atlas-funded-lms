const BOLD_PATTERN = /\*\*(.+?)\*\*/g;

export function defaultSampleValueForVariable(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("date") || normalized.includes("at")) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }
  if (normalized.includes("name") && normalized.includes("course")) {
    return "Sample course title";
  }
  if (normalized.includes("name")) {
    return "Sample member";
  }
  if (normalized.includes("email")) {
    return "member@example.com";
  }
  if (normalized.includes("organization") || normalized.includes("academy") || normalized.includes("tenant")) {
    return "Your organization";
  }
  return `Sample ${name.replace(/_/g, " ")}`;
}

export function buildVariableSampleMap(
  variables: ReadonlyArray<{ name: string }>,
  overrides: Readonly<Record<string, string>>,
): Record<string, string> {
  const samples: Record<string, string> = {};
  for (const variable of variables) {
    samples[variable.name] = overrides[variable.name] ?? defaultSampleValueForVariable(variable.name);
  }
  return samples;
}

export function renderTemplatePreviewText(
  template: string,
  samples: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => samples[name] ?? `{{${name}}}`);
}

export function renderPreviewParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function renderInlinePreviewHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(BOLD_PATTERN, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}
