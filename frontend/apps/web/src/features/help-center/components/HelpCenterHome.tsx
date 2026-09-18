import Link from "next/link";
import { ChevronRight, GraduationCap, Headphones } from "lucide-react";
import { HELP_CATEGORIES, getPopularArticles, getTipOfWeek } from "../help-center-content";
import {
  helpCardClassName,
  helpCategoryIconClassName,
  helpListRowClassName,
  helpOutlineButtonClassName,
  helpPrimaryButtonClassName,
} from "../help-center-styles";
import { HelpSearchBar } from "./HelpSearchBar";

type HelpCenterHomeProps = {
  academyName: string;
};

export function HelpCenterHome({ academyName }: HelpCenterHomeProps) {
  const popular = getPopularArticles(5);
  const tip = getTipOfWeek();

  return (
    <div className="-mx-4 -mt-2 sm:-mx-6 lg:-mx-8">
      <section className="border-b border-border bg-[color-mix(in_srgb,var(--card)_70%,var(--background))] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl md:text-5xl">
            How can we help?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Guides for {academyName}: courses, diagnostics, certificates, billing, and
            troubleshooting.
          </p>
          <div className="mt-8 text-left">
            <HelpSearchBar />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="help-categories-heading">
          <h2 id="help-categories-heading" className="sr-only">
            Browse by category
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {HELP_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <Link
                  key={category.id}
                  href={`/help/category/${category.id}`}
                  className={helpCardClassName}
                >
                  <div className={helpCategoryIconClassName}>
                    <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold text-foreground">{category.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-primary">Popular articles</h2>
              <Link
                href="/help/category/getting-started"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <ul className="space-y-2">
              {popular.map((article) => (
                <li key={article.slug}>
                  <Link href={`/help/${article.slug}`} className={helpListRowClassName}>
                    <span className="text-base text-foreground motion-safe:transition-colors group-hover:text-primary">
                      {article.title}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5">
            <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-border bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))] shadow-sm">
              <div
                className="absolute inset-0 opacity-40"
                aria-hidden="true"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--primary) 25%, transparent), transparent 45%), radial-gradient(circle at 80% 70%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 50%)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <GraduationCap
                  className="h-24 w-24 text-[color-mix(in_srgb,var(--primary)_35%,transparent)]"
                  strokeWidth={1}
                  aria-hidden="true"
                />
              </div>
              <div className="absolute inset-x-4 bottom-4 rounded-xl border border-border/60 bg-card/90 p-4 backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {tip.label}
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
                  {tip.body}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="border-t border-border bg-muted px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-primary">Still need help?</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Review account and security settings, or browse troubleshooting articles for sign-in and
            playback issues.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/settings" className={helpPrimaryButtonClassName}>
              <Headphones className="h-4 w-4" aria-hidden="true" />
              Account &amp; support settings
            </Link>
            <Link href="/help/category/troubleshooting" className={helpOutlineButtonClassName}>
              Troubleshooting guides
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
