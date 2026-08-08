import type { LocaleQaIssueRow } from "./locale.types";

export type QaIssueDraft = Omit<LocaleQaIssueRow, "id" | "tenant_id" | "run_id" | "created_at">;

const PLACEHOLDER_PATTERN = /\{[a-zA-Z0-9_]+\}/g;

export function extractPlaceholders(value: string): string[] {
  const matches = value.match(PLACEHOLDER_PATTERN) ?? [];
  return [...new Set(matches)].sort();
}

type QaResourceMap = Map<string, string>;

type RunLocaleQaChecksArgs = {
  canonicalKeys: string[];
  sourceLocale: string;
  sourceValues: QaResourceMap;
  localeValuesByLocale: Map<string, QaResourceMap>;
  targetLocales: string[];
};

export function runLocaleQaChecks(args: RunLocaleQaChecksArgs): QaIssueDraft[] {
  const issues: QaIssueDraft[] = [];

  for (const locale of args.targetLocales) {
    if (locale === args.sourceLocale) continue;

    const localeValues = args.localeValuesByLocale.get(locale) ?? new Map<string, string>();

    for (const key of args.canonicalKeys) {
      const sourceValue = args.sourceValues.get(key);
      const translatedValue = localeValues.get(key);

      if (!translatedValue) {
        issues.push({
          locale,
          key,
          severity: "error",
          issue_type: "missing_key",
          message: `Missing translation for canonical key "${key}".`,
        });
        continue;
      }

      if (translatedValue.trim().length === 0) {
        issues.push({
          locale,
          key,
          severity: "error",
          issue_type: "empty_translation",
          message: `Translation for "${key}" is empty.`,
        });
        continue;
      }

      if (sourceValue) {
        const sourcePlaceholders = extractPlaceholders(sourceValue);
        const translatedPlaceholders = extractPlaceholders(translatedValue);
        const sourceSet = new Set(sourcePlaceholders);
        const translatedSet = new Set(translatedPlaceholders);

        const missing = sourcePlaceholders.filter((placeholder) => !translatedSet.has(placeholder));
        const extra = translatedPlaceholders.filter((placeholder) => !sourceSet.has(placeholder));

        if (missing.length > 0 || extra.length > 0) {
          issues.push({
            locale,
            key,
            severity: "warning",
            issue_type: "placeholder_mismatch",
            message: `Placeholder mismatch for "${key}" (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}).`,
          });
        }

        if (translatedValue.length > sourceValue.length * 2 && translatedValue.length > 40) {
          issues.push({
            locale,
            key,
            severity: "info",
            issue_type: "length_warning",
            message: `Translation for "${key}" is more than 2× the source length.`,
          });
        }
      }
    }
  }

  return issues;
}

export function buildImportPreview(args: {
  locale: string;
  incoming: Array<{ key: string; value: string }>;
  existing: Map<string, string>;
}) {
  const entries = args.incoming.map((item) => {
    const currentValue = args.existing.get(item.key) ?? null;
    if (currentValue === null) {
      return {
        key: item.key,
        action: "add" as const,
        currentValue: null,
        nextValue: item.value,
      };
    }
    if (currentValue === item.value) {
      return {
        key: item.key,
        action: "unchanged" as const,
        currentValue,
        nextValue: item.value,
      };
    }
    return {
      key: item.key,
      action: "update" as const,
      currentValue,
      nextValue: item.value,
    };
  });

  const summary = {
    add: entries.filter((entry) => entry.action === "add").length,
    update: entries.filter((entry) => entry.action === "update").length,
    unchanged: entries.filter((entry) => entry.action === "unchanged").length,
  };

  return { locale: args.locale, summary, entries };
}
