import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, Lightbulb } from "lucide-react";
import type { HelpContentBlock, HelpArticleSection } from "../help-center-types";

type HelpArticleContentProps = {
  sections: HelpArticleSection[];
};

export function HelpArticleContent({ sections }: HelpArticleContentProps) {
  return (
    <div className="article-content space-y-10">
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-24">
          <h2 className="mb-4 text-xl font-semibold text-primary">{section.title}</h2>
          <div className="space-y-4">
            {section.blocks.map((block, index) => (
              <HelpBlock key={`${section.id}-${index}`} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function HelpBlock({ block }: { block: HelpContentBlock }) {
  switch (block.type) {
    case "p":
      return <p className="text-base leading-relaxed text-muted-foreground">{block.text}</p>;
    case "h2":
      return (
        <h3 id={block.id} className="mt-8 scroll-mt-24 text-lg font-semibold text-primary">
          {block.text}
        </h3>
      );
    case "h3":
      return <h4 className="text-base font-semibold text-foreground">{block.text}</h4>;
    case "ul":
      return (
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          {block.items.map((item) => (
            <li key={item} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          {block.items.map((item) => (
            <li key={item} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ol>
      );
    case "step":
      return (
        <div className="flex gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-sm font-bold text-primary">
            {block.number}
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">{block.title}</p>
            <p className="mt-1 text-base leading-relaxed text-muted-foreground">{block.body}</p>
          </div>
        </div>
      );
    case "callout":
      return <HelpCallout block={block} />;
    default:
      return null;
  }
}

function HelpCallout({
  block,
}: {
  block: Extract<HelpContentBlock, { type: "callout" }>;
}) {
  const styles = {
    tip: {
      icon: Lightbulb,
      surface:
        "border-[color-mix(in_srgb,var(--primary)_22%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]",
      label: "Tip",
    },
    note: {
      icon: Info,
      surface:
        "border-[color-mix(in_srgb,var(--muted-foreground)_22%,transparent)] bg-muted",
      label: "Note",
    },
    warning: {
      icon: AlertTriangle,
      surface:
        "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]",
      label: "Important",
    },
  }[block.variant];

  const Icon = styles.icon;

  return (
    <aside
      className={`rounded-xl border p-4 ${styles.surface}`}
      role={block.variant === "warning" ? "note" : undefined}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {block.title ?? styles.label}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{block.text}</p>
        </div>
      </div>
    </aside>
  );
}

type HelpBreadcrumbsProps = {
  categoryTitle: string;
  categoryId: string;
  articleTitle: string;
};

export function HelpBreadcrumbs({ categoryTitle, categoryId, articleTitle }: HelpBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link href="/help" className="text-primary hover:underline">
        Help Center
      </Link>
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
      <Link href={`/help/category/${categoryId}`} className="text-primary hover:underline">
        {categoryTitle}
      </Link>
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
      <span className="text-foreground">{articleTitle}</span>
    </nav>
  );
}
