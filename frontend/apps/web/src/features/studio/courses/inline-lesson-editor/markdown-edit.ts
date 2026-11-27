/**
 * Text edits the article toolbar makes, as pure functions of the text and the
 * selection, so the editor applies them through React state (the toolbar used
 * to write the textarea directly, which React doesn't see).
 */
export type MarkdownEdit = { value: string; start: number; end: number };

/** Wraps the selection, e.g. in `**`; with nothing selected inserts a placeholder. */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string,
): MarkdownEdit {
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
  const from = start + marker.length;
  return { value: next, start: from, end: from + selected.length };
}

/** The start and end of the whole lines the selection touches. */
function lineRange(value: string, start: number, end: number): [number, number] {
  const from = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const newline = value.indexOf("\n", end);
  return [start === 0 ? 0 : from, newline === -1 ? value.length : newline];
}

export type LinePrefix = "h2" | "h3" | "bullet" | "numbered" | "quote";

const HEADING_MARK = /^#{1,6}\s+/;
const LIST_MARK = /^(\s*)(?:[-*+]|\d+[.)])\s+/;
const QUOTE_MARK = /^\s*>\s?/;

/**
 * Turns every selected line into a heading, list item or quote line. Lines
 * that already have a marker of that family get it replaced, not doubled.
 */
export function prefixLines(
  value: string,
  start: number,
  end: number,
  kind: LinePrefix,
): MarkdownEdit {
  const [from, to] = lineRange(value, start, end);
  const lines = value.slice(from, to).split("\n");
  const changed = lines.map((line, index) => {
    if (kind === "h2" || kind === "h3") {
      const text = line.replace(HEADING_MARK, "");
      return `${kind === "h2" ? "#" : "##"} ${text || "Heading"}`;
    }
    if (kind === "quote") return `> ${line.replace(QUOTE_MARK, "")}`;
    const text = line.replace(LIST_MARK, "$1");
    return `${kind === "bullet" ? "-" : `${String(index + 1)}.`} ${text.trim() || "Item"}`;
  });
  const replaced = changed.join("\n");
  return {
    value: value.slice(0, from) + replaced + value.slice(to),
    start: from,
    end: from + replaced.length,
  };
}

/**
 * Inserts a block (an image, a table, a divider) on its own lines, with a
 * blank line before and after so it isn't read as part of a paragraph.
 * `select` picks a part of the block to leave selected, e.g. "Column 1".
 */
export function insertBlock(
  value: string,
  start: number,
  end: number,
  block: string,
  select?: string,
): MarkdownEdit {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead =
    before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail =
    after.length === 0
      ? "\n"
      : after.startsWith("\n\n")
        ? ""
        : after.startsWith("\n")
          ? "\n"
          : "\n\n";
  const next = before + lead + block + trail + after;
  const blockStart = before.length + lead.length;
  const offset = select ? block.indexOf(select) : -1;
  if (offset >= 0 && select) {
    return { value: next, start: blockStart + offset, end: blockStart + offset + select.length };
  }
  const caret = blockStart + block.length + trail.length;
  return { value: next, start: caret, end: caret };
}

export function insertLink(value: string, start: number, end: number): MarkdownEdit {
  const label = value.slice(start, end) || "link text";
  const markdown = `[${label}](https://)`;
  const next = value.slice(0, start) + markdown + value.slice(end);
  const urlStart = start + label.length + 3;
  return { value: next, start: urlStart, end: urlStart + "https://".length };
}

export const TABLE_TEMPLATE = [
  "| Column 1 | Column 2 | Column 3 |",
  "| --- | --- | --- |",
  "| Cell | Cell | Cell |",
  "| Cell | Cell | Cell |",
].join("\n");

/** `![alt](source)` with brackets in the alt text removed, so the link stays valid. */
export function imageMarkdown(alt: string, source: string): string {
  const cleanAlt = alt.replace(/[[\]\n]/g, " ").trim();
  return `![${cleanAlt}](${source.trim()})`;
}
