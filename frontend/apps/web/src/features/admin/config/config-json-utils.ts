export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string; line: number | null; column: number | null };

export function parseJsonDraft(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      return { ok: false, message: "Invalid JSON", line: null, column: null };
    }

    const positionMatch = error.message.match(/position (\d+)/i);
    const position = positionMatch ? Number(positionMatch[1]) : null;
    let line: number | null = null;
    let column: number | null = null;

    if (position != null && Number.isFinite(position)) {
      const before = text.slice(0, position);
      line = before.split("\n").length;
      const lastNewline = before.lastIndexOf("\n");
      column = position - lastNewline;
    }

    const message = error.message.replace(/^JSON\.parse:\s*/i, "").trim();
    return { ok: false, message, line, column };
  }
}

export function countLines(text: string): number {
  if (!text) return 1;
  return text.split("\n").length;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function canRenderAsForm(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;

  return Object.values(value).every((entry) => {
    if (entry === null) return true;
    const type = typeof entry;
    if (type === "string" || type === "boolean" || type === "number") return true;
    if (Array.isArray(entry)) {
      return entry.every((item) => typeof item === "string" || typeof item === "number");
    }
    if (isPlainObject(entry)) {
      return Object.values(entry).every(
        (nested) =>
          nested === null ||
          typeof nested === "string" ||
          typeof nested === "boolean" ||
          typeof nested === "number",
      );
    }
    return false;
  });
}
