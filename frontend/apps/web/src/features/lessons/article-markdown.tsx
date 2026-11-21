import { Fragment, type ReactNode } from "react";

/**
 * Renders an article's text: the small Markdown subset the Studio article
 * toolbar writes (bold, italic, links, bulleted lists) plus what authors type
 * by hand (headings, numbered lists, inline code, code blocks).
 *
 * It builds React elements directly and never injects HTML, so nothing an
 * author writes can run as script. Links open only for http, https and mailto.
 */

type Block =
  | { kind: "heading"; level: 2 | 3 | 4; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; text: string }
  | { kind: "paragraph"; lines: string[] };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const FENCE = /^\s*```/;

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
