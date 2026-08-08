const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|token|secret|password|dsn|database.?url|connection.?string|signed.?url|signature|payload|request.?body|response.?body|object.?key/i;

const REDACTED = "[REDACTED]";

export function redactValue(value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    if (/^req_[a-f0-9-]{36}$/i.test(value)) {
      return value;
    }

    if (/^https?:\/\/.+\?.*(X-Amz-Signature|sig|token|signature)=/i.test(value)) {
      return REDACTED;
    }

    if (/postgres(ql)?:\/\//i.test(value)) {
      return REDACTED;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (typeof value === "object") {
    return redactObject(value as Record<string, unknown>);
  }

  return value;
}

export function redactObject(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = REDACTED;
      continue;
    }

    output[key] = redactValue(value);
  }

  return output;
}
