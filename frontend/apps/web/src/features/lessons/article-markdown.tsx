import { Fragment, type ReactNode } from "react";

/**
 * Renders an article's text: the Markdown the Studio article toolbar writes
 * (headings, bold, italic, links, lists, quotes, images, tables, dividers)
 * plus inline code and code blocks typed by hand.
 *
 * It builds React elements directly and never injects HTML, so nothing an
 * author writes can run as script. Links open only for http, https and mailto.
 */

type TableAlign = "left" | "center" | "right" | null;

type Block =
  | { kind: "heading"; level: 2 | 3 | 4; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "image"; alt: string; src: string }
  | { kind: "table"; header: string[]; align: TableAlign[]; rows: string[][] }
  | { kind: "rule" }
  | { kind: "paragraph"; lines: string[] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const FENCE = /^\s*```/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
/** A line that is only an image: shown as a figure, not inside a paragraph. */
const IMAGE_LINE = /^\s*!\[([^\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))+)\)\s*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/;

/** The cells of a `| a | b |` row, trimmed; `\|` stays a literal bar. */
export function tableCells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function tableAlign(cell: string): TableAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

/** Splits the text into blocks, line by line. */
export function parseArticleBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (FENCE.test(line)) {
      flushParagraph();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index] ?? "")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    if (TABLE_ROW.test(line) && TABLE_SEPARATOR.test(lines[index + 1] ?? "")) {
      flushParagraph();
      const header = tableCells(line);
      const align = tableCells(lines[index + 1] ?? "").map(tableAlign);
      index += 1;
      const rows: string[][] = [];
      while (index + 1 < lines.length && TABLE_ROW.test(lines[index + 1] ?? "")) {
        index += 1;
        const cells = tableCells(lines[index] ?? "");
        // Every row has the header's number of cells.
        rows.push(header.map((_, column) => cells[column] ?? ""));
      }
      blocks.push({ kind: "table", header, align, rows });
      continue;
    }

    if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ kind: "rule" });
      continue;
    }

    const image = IMAGE_LINE.exec(line);
    if (image) {
      flushParagraph();
      blocks.push({ kind: "image", alt: image[1] ?? "", src: image[2] ?? "" });
      continue;
    }

    if (QUOTE.test(line)) {
      flushParagraph();
      const quoted = [QUOTE.exec(line)?.[1] ?? ""];
      while (index + 1 < lines.length && QUOTE.test(lines[index + 1] ?? "")) {
        index += 1;
        quoted.push(QUOTE.exec(lines[index] ?? "")?.[1] ?? "");
      }
      blocks.push({ kind: "quote", lines: quoted });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      const level = (heading[1]?.length ?? 1) + 1;
      blocks.push({ kind: "heading", level: level as 2 | 3 | 4, text: heading[2] ?? "" });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const pattern = ordered ? NUMBERED : BULLET;
      const items = [(bullet ?? numbered)?.[1] ?? ""];
      while (index + 1 < lines.length && pattern.test(lines[index + 1] ?? "")) {
        index += 1;
        items.push(pattern.exec(lines[index] ?? "")?.[1] ?? "");
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

/**
 * Only web addresses load as images. A reference the API couldn't sign
 * (`asset:…` from another lesson, or deleted) shows its alt text instead.
 */
export function safeImageSrc(url: string): string | null {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function ArticleImage({
  alt,
  src,
  inline = false,
}: {
  alt: string;
  src: string;
  inline?: boolean;
}) {
  const safe = safeImageSrc(src);
  if (!safe) {
    return alt ? <span className="italic text-muted-foreground">[Image: {alt}]</span> : null;
  }
  return (
    <img
      src={safe}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={
        inline
          ? "inline-block max-h-[1.5em] align-middle"
          : "mx-auto max-h-[32rem] w-auto max-w-full rounded-xl border border-border"
      }
    />
  );
}

/** Only these link targets are followed; anything else shows as plain text. */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : null;
}

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)|(!?\[[^\]\n]+\]\((?:[^()\s]|\([^()\s]*\))+\))/;

/** Inline Markdown in one line of text, as React nodes. */
export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let index = 0;

  while (rest.length > 0) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push(rest);
      break;
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${String(index)}`;
    index += 1;

    if (match[1]) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {renderInline(token.slice(2, -2), key)}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    } else if (match[4]) {
      // A URL may hold one level of brackets, as Wikipedia links do.
      const link = /^!?\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)$/.exec(token);
      const label = link?.[1] ?? token;
      if (token.startsWith("!")) {
        nodes.push(<ArticleImage key={key} alt={label} src={link?.[2] ?? ""} inline />);
        rest = rest.slice(match.index + token.length);
        continue;
      }
      const href = safeHref(link?.[2] ?? "");
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            {label}
          </a>
        ) : (
          <Fragment key={key}>{label}</Fragment>
        ),
      );
    }

    rest = rest.slice(match.index + token.length);
  }

  return nodes;
}

export function ArticleMarkdown({ text }: { text: string }) {
  const blocks = parseArticleBlocks(text);

  return (
    <div className="space-y-4 text-base leading-relaxed text-foreground">
      {blocks.map((block, index) => {
        const key = `b-${String(index)}`;
        switch (block.kind) {
          case "heading": {
            const Tag = `h${String(block.level)}` as "h2" | "h3" | "h4";
            const size =
              block.level === 2 ? "text-xl" : block.level === 3 ? "text-lg" : "text-base";
            return (
              <Tag key={key} className={`${size} pt-2 font-semibold text-foreground`}>
                {renderInline(block.text, key)}
              </Tag>
            );
          }
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List
                key={key}
                className={`space-y-1 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${String(itemIndex)}`}>
                    {renderInline(item, `${key}-${String(itemIndex)}`)}
                  </li>
                ))}
              </List>
            );
          }
          case "code":
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-sm"
              >
                <code>{block.text}</code>
              </pre>
            );
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-4 border-primary/40 bg-muted/40 py-2 pl-4 pr-3 text-foreground/90"
              >
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={`${key}-${String(lineIndex)}`}>
                    {lineIndex > 0 ? <br /> : null}
                    {renderInline(line, `${key}-${String(lineIndex)}`)}
                  </Fragment>
                ))}
              </blockquote>
            );
          case "image":
            return (
              <figure key={key} className="space-y-2">
                <ArticleImage alt={block.alt} src={block.src} />
                {block.alt && safeImageSrc(block.src) ? (
                  <figcaption className="text-center text-sm text-muted-foreground">
                    {block.alt}
                  </figcaption>
                ) : null}
              </figure>
            );
          case "table":
            return (
              <div key={key} className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      {block.header.map((cell, column) => (
                        <th
                          key={`${key}-h-${String(column)}`}
                          scope="col"
                          className="border-b border-border px-3 py-2 font-semibold text-foreground"
                          style={{ textAlign: block.align[column] ?? "left" }}
                        >
                          {renderInline(cell, `${key}-h-${String(column)}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${key}-r-${String(rowIndex)}`} className="even:bg-muted/30">
                        {row.map((cell, column) => (
                          <td
                            key={`${key}-r-${String(rowIndex)}-${String(column)}`}
                            className="border-b border-border px-3 py-2 align-top"
                            style={{ textAlign: block.align[column] ?? "left" }}
                          >
                            {renderInline(cell, `${key}-r-${String(rowIndex)}-${String(column)}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "rule":
            return <hr key={key} className="border-border" />;
          case "paragraph":
            return (
              <p key={key}>
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={`${key}-${String(lineIndex)}`}>
                    {lineIndex > 0 ? <br /> : null}
                    {renderInline(line, `${key}-${String(lineIndex)}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
