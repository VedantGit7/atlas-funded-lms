"use client";

import { cn } from "@atlas/design-system";
import type { ResourceItem } from "@atlas/contracts/resources/schemas";
import { KIND_META, formatResourceDate, resourceMetaLabel } from "./resource-view";

type ResourceCardProps = {
  resource: ResourceItem;
  view: "grid" | "list";
};

/** Token-gradient thumbnail with the kind glyph; no fabricated stock imagery. */
function Thumbnail({ resource, className }: { resource: ResourceItem; className?: string }) {
  const meta = KIND_META[resource.kind];
  const { Icon } = meta;
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden bg-muted", className)}
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${meta.tone} 20%, var(--card)), var(--card))`,
      }}
    >
      <Icon
        className="transition-transform duration-300 group-hover:scale-110"
        style={{ color: meta.tone, width: "40%", height: "40%", opacity: 0.9 }}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      {resource.kind === "video" ? (
        <span
          className="absolute inset-0 flex items-center justify-center transition-colors"
          style={{ background: "color-mix(in srgb, var(--warning) 12%, transparent)" }}
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-transform group-hover:scale-110"
            style={{ background: "var(--warning)", color: "var(--primary-foreground)" }}
          >
            <meta.ActionIcon className="h-6 w-6" aria-hidden="true" />
          </span>
        </span>
      ) : null}
      {resource.kind === "link" ? (
        <span
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md"
          style={{ background: "var(--success)", color: "var(--primary-foreground)" }}
        >
          <meta.Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
}

function ActionButton({ resource }: { resource: ResourceItem }) {
  const meta = KIND_META[resource.kind];
  const { ActionIcon } = meta;
  const label = `${meta.actionLabel} ${resource.title}`;

  const shared =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] motion-safe:active:scale-95";

  if (!resource.href) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${meta.actionLabel} unavailable`}
        className={cn(shared, "cursor-not-allowed opacity-40")}
      >
        <ActionIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <a
      href={resource.href}
      target="_blank"
      rel="noreferrer"
      {...(resource.external ? {} : { download: "" })}
      aria-label={label}
      className={cn(
        shared,
        "hover:border-transparent hover:bg-[var(--kind-tone)] hover:text-[color:var(--primary-foreground)]",
      )}
      style={{ ["--kind-tone" as string]: meta.tone }}
    >
      <ActionIcon className="h-5 w-5" aria-hidden="true" />
    </a>
  );
}

function Meta({ resource }: { resource: ResourceItem }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        {resourceMetaLabel(resource.kind, resource.sizeBytes)}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {formatResourceDate(resource.createdAt)}
      </span>
    </div>
  );
}

export function ResourceCard({ resource, view }: ResourceCardProps) {
  const meta = KIND_META[resource.kind];

  if (view === "list") {
    return (
      <article className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3 transition-all duration-200 hover:border-primary hover:shadow-[0_4px_12px_color-mix(in_srgb,var(--foreground)_6%,transparent)]">
        <Thumbnail resource={resource} className="h-16 w-24 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: `color-mix(in srgb, ${meta.tone} 14%, transparent)`,
                color: meta.tone,
              }}
            >
              {meta.label}
            </span>
            {resource.category ? (
              <span className="truncate text-xs text-muted-foreground">{resource.category}</span>
            ) : null}
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-foreground group-hover:text-primary">
            {resource.title}
          </h3>
          {resource.description ? (
            <p className="truncate text-xs text-muted-foreground">{resource.description}</p>
          ) : null}
        </div>
        <div className="hidden sm:block">
          <Meta resource={resource} />
        </div>
        <ActionButton resource={resource} />
      </article>
    );
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary hover:shadow-[0_4px_12px_color-mix(in_srgb,var(--foreground)_6%,transparent)]">
      <Thumbnail resource={resource} className="aspect-video w-full" />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: `color-mix(in srgb, ${meta.tone} 14%, transparent)`,
              color: meta.tone,
            }}
          >
            {meta.label}
          </span>
          {resource.category ? (
            <span className="truncate text-xs text-muted-foreground">{resource.category}</span>
          ) : null}
        </div>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {resource.title}
        </h3>
        {resource.description ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{resource.description}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <Meta resource={resource} />
          <ActionButton resource={resource} />
        </div>
      </div>
    </article>
  );
}
