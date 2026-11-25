/**
 * Plain-language reasons for a rejected request (QA S2.5, review 2 H33).
 *
 * A failed input check used to answer only "Invalid request", so a bad slug, a
 * relative CTA link or a missing title failed with nothing the person could
 * act on. This names the field and says what it needs, in words a client
 * understands. It reads only the schema's own rules (lengths, formats,
 * allowed options) and the field names, never the submitted values, so
 * nothing the person typed is echoed back.
 *
 * Duck-typed on purpose: `@atlas/core` does not depend on Zod, and the issue
 * shape below is shared by Zod 3 and 4.
 */

type ValidationIssue = {
  code?: string;
  path?: ReadonlyArray<PropertyKey>;
  message?: string;
  expected?: string;
  input?: unknown;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  inclusive?: boolean;
  exact?: boolean;
  format?: string;
  prefix?: string;
  values?: ReadonlyArray<unknown>;
  /** Zod 4 union failures: the issues of each option that was tried. */
  errors?: ReadonlyArray<ReadonlyArray<ValidationIssue>>;
  /** Zod 3 union failures. */
  unionErrors?: ReadonlyArray<{ issues?: ReadonlyArray<ValidationIssue> }>;
};

const GENERIC_MESSAGE = "Some of the details aren't valid. Check the form and try again.";

/** Zod's own English messages; anything else was written by a schema author. */
const DEFAULT_MESSAGE = /^(Invalid |Too (small|big)|Unrecognized key|Expected |Required$)/;

const WORD_FIXES: Record<string, string> = {
  url: "URL",
  urls: "URLs",
  id: "ID",
  ids: "IDs",
  seo: "SEO",
  cta: "CTA",
  utm: "UTM",
  html: "HTML",
  css: "CSS",
  sms: "SMS",
  otp: "OTP",
  api: "API",
};

const FIELD_NAMES: Record<string, string> = {
  slug: "Web address",
  href: "Link",
  linkUrl: "Link",
  ctaUrl: "Button link",
};

function fieldKey(path: ReadonlyArray<PropertyKey> | undefined): string | null {
  if (!path) return null;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const segment = path[index];
    if (typeof segment === "string" && segment.length > 0) return segment;
  }
  return null;
}

/** "linkUrl" as "Link URL", "start_at" as "Start at". */
export function humanizeFieldName(key: string): string {
  const named = FIELD_NAMES[key];
  if (named) return named;
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  if (words.length === 0) return "This field";
  const [first, ...rest] = words.map((word) => WORD_FIXES[word] ?? word);
  const head = first ?? "";
  return [head.charAt(0).toUpperCase() + head.slice(1), ...rest].join(" ");
}

function isSlugKey(key: string | null): boolean {
  return key !== null && /slug$/i.test(key);
}

function plural(count: number | bigint, unit: string): string {
  return `${count.toString()} ${unit}${Number(count) === 1 ? "" : "s"}`;
}

function describeIssue(issue: ValidationIssue): string {
  const key = fieldKey(issue.path);
  const field = key ? humanizeFieldName(key) : "This field";

  if (issue.message && !DEFAULT_MESSAGE.test(issue.message)) return issue.message;

  if (issue.code === "invalid_union") {
    // "A link, an empty value or nothing": the option with its own words
    // explains the rule ("Enter a full web address…").
    const nested = [
      ...(issue.errors ?? []).flat(),
      ...(issue.unionErrors ?? []).flatMap((union) => union.issues ?? []),
    ];
    const written = nested.find(
      (inner) => inner.message !== undefined && !DEFAULT_MESSAGE.test(inner.message),
    );
    if (written?.message) return written.message;
  }

  switch (issue.code) {
    case "invalid_type": {
      if (issue.input === undefined || issue.input === null || issue.message === "Required") {
        return `${field} is required.`;
      }
      if (issue.expected === "number" || issue.expected === "int") {
        return `${field} must be a number.`;
      }
      if (issue.expected === "date") return `${field} must be a date.`;
      if (issue.expected === "array") return `${field} must be a list.`;
      return `${field} isn't valid.`;
    }
    case "too_small": {
      const minimum = issue.minimum ?? 0;
      if (issue.origin === "string") {
        return Number(minimum) <= 1
          ? `${field} is required.`
          : `${field} needs at least ${plural(minimum, "character")}.`;
      }
      if (issue.origin === "array" || issue.origin === "set") {
        return `${field} needs at least ${plural(minimum, "item")}.`;
      }
      return issue.inclusive === false
        ? `${field} must be more than ${minimum.toString()}.`
        : `${field} must be at least ${minimum.toString()}.`;
    }
    case "too_big": {
      const maximum = issue.maximum ?? 0;
      if (issue.origin === "string") {
        return `${field} can be at most ${plural(maximum, "character")}.`;
      }
      if (issue.origin === "array" || issue.origin === "set") {
        return `${field} can have at most ${plural(maximum, "item")}.`;
      }
      return issue.inclusive === false
        ? `${field} must be less than ${maximum.toString()}.`
        : `${field} can be at most ${maximum.toString()}.`;
    }
    case "invalid_format":
    case "invalid_string": {
      if (issue.format === "email") return `${field} must be an email address.`;
      if (issue.format === "url") {
        return `${field} must be a full web address, starting with https://.`;
      }
      if (issue.format === "datetime" || issue.format === "date") {
        return `${field} must be a date.`;
      }
      if (issue.format === "starts_with" && issue.prefix) {
        return `${field} must start with "${issue.prefix}".`;
      }
      if (isSlugKey(key)) {
        return `${field} can use only lowercase letters, numbers and hyphens.`;
      }
      return `${field} isn't in the right format.`;
    }
    case "invalid_value":
    case "invalid_enum_value": {
      const values = (issue.values ?? []).filter(
        (value): value is string | number => typeof value === "string" || typeof value === "number",
      );
      if (values.length > 0 && values.length <= 5) {
        return `${field} must be one of: ${values.join(", ")}.`;
      }
      return `${field} isn't one of the allowed options.`;
    }
    case "unrecognized_keys":
      // Not something the person can fix: the page sent a field the server
      // doesn't know, which means the page is older than the server.
      return "This page is out of date. Reload it and try again.";
    default:
      return `${field} isn't valid.`;
  }
}

/**
 * One sentence for the first problem, then the other fields to check, so the
 * person can fix everything in one go instead of one rejection at a time.
 */
export function describeValidationIssues(issues: ReadonlyArray<ValidationIssue>): string {
  if (issues.length === 0) return GENERIC_MESSAGE;
  const [first, ...rest] = issues;
  if (!first) return GENERIC_MESSAGE;
  const message = describeIssue(first);
  const firstKey = fieldKey(first.path);
  const others = [
    ...new Set(
      rest
        .map((issue) => fieldKey(issue.path))
        .filter((key): key is string => key !== null && key !== firstKey)
        .map(humanizeFieldName),
    ),
  ];
  if (others.length === 0) return message;
  return `${message} Also check: ${others.slice(0, 3).join(", ")}${others.length > 3 ? " and more" : ""}.`;
}

export function describeValidationError(error: unknown): string {
  const issues =
    error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)
      ? (error.issues as ValidationIssue[])
      : [];
  return describeValidationIssues(issues);
}
