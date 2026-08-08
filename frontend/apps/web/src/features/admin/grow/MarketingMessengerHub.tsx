"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Cable,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  KeyRound,
  LockOpen,
  Mail,
  Megaphone,
  MessageCircle,
  Search,
  Settings2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import {
  managePageDescClassName,
  managePageTitleClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  AUDIT_HREF,
  formatCompactCount,
  formatLastPing,
  formatRelativeTime,
  INTEGRATIONS_HREF,
  type MessengerHubSummary,
} from "./messenger-hub-shared";

type FilterTab = "all" | "active" | "beta";

type ChannelCardId =
  | "push-message"
  | "marketing-email"
  | "system-email"
  | "announcements"
  | "whatsapp";

type ChannelMeta = {
  id: ChannelCardId;
  title: string;
  description: string;
  href: string;
  createHref?: string;
  badge?: "beta";
  keywords: string[];
};

const CHANNELS: readonly ChannelMeta[] = [
  {
    id: "push-message",
    title: "Push Message",
    description: "Reach learners on mobile and web with time-sensitive alerts.",
    href: "/admin/marketing/messenger/push",
    createHref: "/admin/marketing/messenger/push/create",
    badge: "beta",
    keywords: ["push", "notification", "mobile", "alert"],
  },
  {
    id: "marketing-email",
    title: "Marketing Email",
    description: "Drip campaigns and high-volume newsletters from one engine.",
    href: "/admin/marketing/messenger/email",
    createHref: "/admin/marketing/messenger/email/create",
    keywords: ["email", "campaign", "newsletter", "drip"],
  },
  {
    id: "system-email",
    title: "System Email",
    description: "Transactional mail for password resets and account alerts.",
    href: "/admin/marketing/messenger/system-email",
    keywords: ["system", "transactional", "password", "security"],
  },
  {
    id: "announcements",
    title: "Announcements",
    description: "App-wide banners and internal broadcasts for all learners.",
    href: "/admin/marketing/messenger/announcements",
    createHref: "/admin/marketing/messenger/announcements/create",
    keywords: ["announcement", "banner", "broadcast"],
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Rich messaging on the chat channel learners already use.",
    href: "/admin/marketing/messenger/whatsapp",
    createHref: "/admin/marketing/messenger/whatsapp/create",
    badge: "beta",
    keywords: ["whatsapp", "chat", "meta"],
  },
];

const FILTER_TABS: ReadonlyArray<{ id: FilterTab; label: string }> = [
  { id: "all", label: "All channels" },
  { id: "active", label: "Active" },
  { id: "beta", label: "Beta" },
];

const QUICK_ACTIONS = [
  { label: "New email campaign", href: "/admin/marketing/messenger/email/create" },
  { label: "New push message", href: "/admin/marketing/messenger/push/create" },
  { label: "New announcement", href: "/admin/marketing/messenger/announcements/create" },
  { label: "WhatsApp campaign", href: "/admin/marketing/messenger/whatsapp/create" },
] as const;

type HubResponse = { data: MessengerHubSummary };

function emptySummary(): MessengerHubSummary {
  return {
    email: {
      activeCount: 0,
      scheduledCount: 0,
      draftCount: 0,
      sentCount: 0,
      totalReach: 0,
      weeklySent: [0, 0, 0, 0, 0, 0, 0],
      latestTitle: null,
    },
    push: { activeCount: 0, sentCount: 0, totalReach: 0 },
    systemEmail: { enabledCount: 0, totalCount: 0 },
    announcements: { sentCount: 0, totalReach: 0 },
    whatsapp: { connectionStatus: "DISCONNECTED", activeCount: 0, sentCount: 0 },
    integrations: {
      webhookCount: 0,
      webhookEnabledCount: 0,
      lastDeliveryAt: null,
      lastDeliveryOk: null,
      apiKeyConfigured: false,
    },
    activity: [],
  };
}

function channelIsActive(id: ChannelCardId, summary: MessengerHubSummary): boolean {
  switch (id) {
    case "push-message":
      return summary.push.activeCount > 0 || summary.push.sentCount > 0;
    case "marketing-email":
      return summary.email.activeCount > 0 || summary.email.sentCount > 0;
    case "system-email":
      return summary.systemEmail.enabledCount > 0;
    case "announcements":
      return summary.announcements.sentCount > 0;
    case "whatsapp":
      return (
        summary.whatsapp.connectionStatus === "CONNECTED" ||
        summary.whatsapp.activeCount > 0 ||
        summary.whatsapp.sentCount > 0
      );
    default:
      return false;
  }
}

function activityIcon(kind: MessengerHubSummary["activity"][number]["kind"]): LucideIcon {
  if (kind === "scheduled") return Clock3;
  if (kind === "sent") return CheckCircle2;
  if (kind === "connected") return MessageCircle;
  return Mail;
}

function activityTone(kind: MessengerHubSummary["activity"][number]["kind"]): string {
  if (kind === "scheduled") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (kind === "sent") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  return "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]";
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--admin-surface-high)] ${className}`}
      aria-hidden="true"
    />
  );
}

function ChannelBadge({ label }: { label: string }) {
  return (
    <span className="rounded bg-[var(--admin-primary-container)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-primary-container)]">
      {label}
    </span>
  );
}

function IconTile({
  children,
  accent = "primary",
}: {
  children: ReactNode;
  accent?: "primary" | "neutral" | "whatsapp";
}) {
  const accentClass =
    accent === "whatsapp"
      ? "group-hover:bg-[#25D366] group-hover:text-white"
      : accent === "primary"
        ? "group-hover:bg-[var(--admin-primary)] group-hover:text-[var(--admin-on-primary)]"
        : "group-hover:bg-[var(--admin-on-surface)] group-hover:text-[var(--admin-surface)]";

  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--admin-surface-low)] text-[var(--admin-primary)] transition-colors duration-300 ${accentClass}`}
    >
      {children}
    </div>
  );
}

function WeeklySparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div
      className="flex h-12 items-end gap-1 px-1"
      role="img"
      aria-label={`Weekly sends: ${values.join(", ")}`}
    >
      {values.map((value, index) => {
        const height = Math.max(12, Math.round((value / max) * 100));
        const isPeak = value === max && value > 0;
        return (
          <div
            key={`week-${index}`}
            className={`flex-1 rounded-t ${
              isPeak
                ? "bg-[var(--admin-primary)]"
                : "bg-[color-mix(in_srgb,var(--admin-primary)_22%,transparent)]"
            }`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

function QuickActionsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`${manageSecondaryButtonClassName} rounded-xl border-[var(--admin-border)] text-[var(--admin-primary)]`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Zap className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Quick actions
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_18px_40px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
        >
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              role="menuitem"
              prefetch={false}
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:bg-[var(--admin-surface-high)] focus-visible:outline-none"
              onClick={() => setOpen(false)}
            >
              <span>{action.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MarketingMessengerHub() {
  const [summary, setSummary] = useState<MessengerHubSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<HubResponse>(
        "/api/v1/marketing/messenger-hub-summary",
      );
      setSummary(response.data);
    } catch (caught) {
      setSummary(emptySummary());
      toast.error(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not load messenger hub.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.altKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const data = summary ?? emptySummary();

  const visibleChannels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return CHANNELS.filter((channel) => {
      if (filter === "beta" && channel.badge !== "beta") return false;
      if (filter === "active" && !channelIsActive(channel.id, data)) return false;
      if (!normalized) return true;
      const haystack = [channel.title, channel.description, ...channel.keywords]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [data, filter, query]);

  const showChannel = (id: ChannelCardId) =>
    visibleChannels.some((channel) => channel.id === id);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-10 pb-10">
      <header className="flex flex-col gap-6 border-b border-[var(--admin-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
              Messenger hub
            </p>
            <h1 className={`${managePageTitleClassName} text-3xl tracking-tight md:text-[2rem]`}>
              Channel management
            </h1>
          </div>
          <p className={`${managePageDescClassName} max-w-2xl`}>
            Orchestrate cross-platform messaging from one hub. Configure channels, monitor
            performance, and launch automated flows.
          </p>
          <nav className="flex flex-wrap gap-1" aria-label="Channel filters">
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`relative px-3 py-2 text-xs font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] ${
                    active
                      ? "text-[var(--admin-primary)]"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary-strong)]"
                  }`}
                  aria-pressed={active}
                >
                  {tab.label}
                  {active ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--admin-primary)]" />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex min-w-[14rem] items-center rounded-xl border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 py-2">
            <span className="sr-only">Search channels</span>
            <Search
              className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search channels…"
              className="ml-2 w-full border-none bg-transparent text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[color-mix(in_srgb,var(--admin-on-surface-variant)_55%,transparent)]"
            />
          </label>
          <QuickActionsMenu />
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-12 gap-6" aria-busy="true" aria-live="polite">
          <SkeletonBlock className="col-span-12 h-52 md:col-span-4" />
          <SkeletonBlock className="col-span-12 h-72 md:col-span-8" />
          <SkeletonBlock className="col-span-12 h-48 md:col-span-4" />
          <SkeletonBlock className="col-span-12 h-48 md:col-span-4" />
          <SkeletonBlock className="col-span-12 h-48 md:col-span-4" />
        </div>
      ) : visibleChannels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No channels match</p>
          <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
            Try another search term or switch the filter tab.
          </p>
          <button
            type="button"
            className={`${manageSecondaryButtonClassName} mt-5`}
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {showChannel("push-message") ? (
            <Link
              href="/admin/marketing/messenger/push"
              prefetch={false}
              className="group col-span-12 flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[var(--admin-primary)] hover:shadow-[0_12px_32px_color-mix(in_srgb,var(--admin-primary)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] motion-reduce:hover:translate-y-0 md:col-span-4"
            >
              <div>
                <div className="mb-6 flex items-start justify-between gap-3">
                  <IconTile>
                    <Bell className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
                  </IconTile>
                  <ChannelBadge label="Beta" />
                </div>
                <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                  Push Message
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                  Reach learners on mobile and web with time-sensitive alerts.
                </p>
                <p className="mt-4 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                  {data.push.activeCount > 0
                    ? `${data.push.activeCount} in progress`
                    : `${formatCompactCount(data.push.sentCount)} sent`}
                  {data.push.totalReach > 0
                    ? ` · ${formatCompactCount(data.push.totalReach)} reach`
                    : null}
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[var(--admin-primary)] transition-[gap] group-hover:gap-3">
                Configure channel
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          ) : null}

          {showChannel("marketing-email") ? (
            <Link
              href="/admin/marketing/messenger/email"
              prefetch={false}
              className="group col-span-12 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_0_0_2px_var(--admin-primary),0_12px_32px_color-mix(in_srgb,var(--admin-primary)_12%,transparent)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] motion-reduce:hover:translate-y-0 md:col-span-8"
            >
              <div className="flex min-h-0 flex-col lg:min-h-[20rem] lg:flex-row">
                <div className="flex flex-1 flex-col justify-between p-6 md:p-8">
                  <div>
                    <div className="mb-6 flex flex-wrap items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-[0_12px_24px_color-mix(in_srgb,var(--admin-primary)_28%,transparent)]">
                        <Mail className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-primary-strong)]">
                        Flagship channel
                      </span>
                      {data.email.activeCount > 0 ? (
                        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-1 text-xs font-semibold text-[var(--admin-success)]">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--admin-success)] motion-reduce:animate-none" />
                          {data.email.activeCount} campaign
                          {data.email.activeCount === 1 ? "" : "s"} active
                        </span>
                      ) : null}
                    </div>
                    <h2 className="text-2xl font-bold leading-tight tracking-tight text-[var(--admin-on-surface)] md:text-[1.75rem]">
                      Marketing Email
                    </h2>
                    <p className="mt-2 max-w-md text-base leading-relaxed text-[var(--admin-on-surface-variant)]">
                      The core engine for drip campaigns and high-volume newsletters.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-8">
                      <div>
                        <p className="text-lg font-bold tabular-nums text-[var(--admin-on-surface)]">
                          {formatCompactCount(data.email.sentCount)}
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-tight text-[var(--admin-on-surface-variant)]">
                          Campaigns sent
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums text-[var(--admin-on-surface)]">
                          {formatCompactCount(data.email.totalReach)}
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-tight text-[var(--admin-on-surface-variant)]">
                          Active reach
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums text-[var(--admin-on-surface)]">
                          {data.email.scheduledCount}
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-tight text-[var(--admin-on-surface-variant)]">
                          Scheduled
                        </p>
                      </div>
                    </div>
                  </div>
                  <span className="mt-8 inline-flex w-fit items-center gap-3 rounded-xl bg-[var(--admin-primary)] px-5 py-3 text-xs font-semibold text-[var(--admin-on-primary)] shadow-[0_10px_24px_color-mix(in_srgb,var(--admin-primary)_18%,transparent)] transition-colors group-hover:bg-[var(--admin-primary-strong)]">
                    Launch dashboard
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>

                <div className="flex flex-col justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6 md:p-8 lg:w-1/2 lg:border-l lg:border-t-0">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Latest campaign
                    </p>
                    <p className="mt-2 text-base font-semibold text-[var(--admin-on-surface)] text-pretty">
                      {data.email.latestTitle ?? "Create your first email campaign"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                      {data.email.draftCount} drafts · {data.email.scheduledCount} scheduled
                    </p>
                  </div>
                  <div className="mt-8">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-[var(--admin-on-surface-variant)]">
                        Weekly sends
                      </span>
                      <span className="text-[11px] font-bold text-[var(--admin-success)]">
                        {data.email.weeklySent.reduce((sum, value) => sum + value, 0)} this week
                      </span>
                    </div>
                    <div className="mt-3">
                      <WeeklySparkline values={data.email.weeklySent} />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ) : null}

          {showChannel("system-email") ? (
            <Link
              href="/admin/marketing/messenger/system-email"
              prefetch={false}
              className="group col-span-12 flex flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-[var(--admin-primary)] hover:shadow-[0_12px_32px_color-mix(in_srgb,var(--admin-primary)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] motion-reduce:hover:translate-y-0 md:col-span-4"
            >
              <IconTile accent="neutral">
                <Settings2 className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
              </IconTile>
              <h2 className="mt-6 text-lg font-semibold text-[var(--admin-on-surface)]">
                System Email
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                Transactional mail for password resets and account alerts.
              </p>
              <div className="mt-auto flex items-center justify-between border-t border-[var(--admin-border)] pt-6">
                <span className="font-mono text-[11px] uppercase tracking-tight text-[var(--admin-on-surface-variant)]">
                  {data.systemEmail.enabledCount}/{data.systemEmail.totalCount} enabled
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] group-hover:text-[var(--admin-primary)]">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ) : null}

          {showChannel("announcements") ? (
            <Link
              href="/admin/marketing/messenger/announcements"
              prefetch={false}
              className="group col-span-12 flex flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-[var(--admin-primary)] hover:shadow-[0_12px_32px_color-mix(in_srgb,var(--admin-primary)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] motion-reduce:hover:translate-y-0 md:col-span-4"
            >
              <IconTile accent="neutral">
                <Megaphone className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
              </IconTile>
              <h2 className="mt-6 text-lg font-semibold text-[var(--admin-on-surface)]">
                Announcements
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                App-wide banners and internal broadcasts for all learners.
              </p>
              <div className="mt-auto flex items-center justify-between border-t border-[var(--admin-border)] pt-6">
                <span className="font-mono text-[11px] uppercase tracking-tight text-[var(--admin-on-surface-variant)]">
                  {data.announcements.sentCount > 0
                    ? `${formatCompactCount(data.announcements.sentCount)} sent`
                    : "Ready to broadcast"}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] group-hover:text-[var(--admin-primary)]">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ) : null}

          {showChannel("whatsapp") ? (
            <Link
              href="/admin/marketing/messenger/whatsapp"
              prefetch={false}
              className="group relative col-span-12 flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-[var(--admin-primary)] hover:shadow-[0_12px_32px_color-mix(in_srgb,var(--admin-primary)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] motion-reduce:hover:translate-y-0 md:col-span-4"
            >
              <span className="pointer-events-none absolute -bottom-4 -right-4 rotate-12 text-[var(--admin-on-surface)] opacity-[0.06] transition-transform duration-500 group-hover:rotate-0 motion-reduce:transition-none">
                <MessageCircle className="h-[7.5rem] w-[7.5rem]" strokeWidth={1} aria-hidden="true" />
              </span>
              <div className="relative z-[1] flex items-start justify-between gap-3">
                <IconTile accent="whatsapp">
                  <WhatsAppGlyph className="h-7 w-7" />
                </IconTile>
                <ChannelBadge label="Beta" />
              </div>
              <h2 className="relative z-[1] mt-6 text-lg font-semibold text-[var(--admin-on-surface)]">
                WhatsApp
              </h2>
              <p className="relative z-[1] mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                Rich messaging on the chat channel learners already use.
              </p>
              <div className="relative z-[1] mt-auto border-t border-[var(--admin-border)] pt-6">
                {data.whatsapp.connectionStatus === "CONNECTED" ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--admin-success)]">
                    Connected
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--admin-primary)]">
                    Request access
                    <LockOpen className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </div>
            </Link>
          ) : null}
        </div>
      )}

      <section className="grid grid-cols-12 gap-6 border-t border-[var(--admin-border)] pt-10">
        <div className="col-span-12 space-y-4 lg:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Integrations</h2>
            <Link
              href={INTEGRATIONS_HREF}
              prefetch={false}
              className="text-xs font-bold text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
            >
              Manage
            </Link>
          </div>

          <div className="space-y-3">
            <Link
              href={INTEGRATIONS_HREF}
              prefetch={false}
              className="flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm transition-colors hover:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
                <Cable className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--admin-on-surface)]">Webhooks</p>
                <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                  {data.integrations.webhookCount === 0
                    ? "No endpoints configured"
                    : `${data.integrations.webhookEnabledCount} enabled · ${formatLastPing(data.integrations.lastDeliveryAt)}`}
                </p>
              </div>
              {data.integrations.webhookCount > 0 ? (
                <span
                  className={`h-2 w-2 rounded-full ${
                    data.integrations.lastDeliveryOk === false
                      ? "bg-[var(--admin-danger)]"
                      : "bg-[var(--admin-success)]"
                  }`}
                  aria-label={
                    data.integrations.lastDeliveryOk === false
                      ? "Last delivery failed"
                      : "Webhooks healthy"
                  }
                />
              ) : null}
            </Link>

            <Link
              href={INTEGRATIONS_HREF}
              prefetch={false}
              className={`flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm transition-colors hover:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] ${
                data.integrations.apiKeyConfigured ? "" : "opacity-70"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
                <KeyRound className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--admin-on-surface)]">SDK keys</p>
                <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                  {data.integrations.apiKeyConfigured
                    ? "API key configured"
                    : "Generate a key to start"}
                </p>
              </div>
            </Link>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Activity feed</h2>
              <Link
                href={AUDIT_HREF}
                prefetch={false}
                className="text-xs font-bold text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
              >
                View audit log
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4">
                <SkeletonBlock className="h-14" />
                <SkeletonBlock className="h-14" />
                <SkeletonBlock className="h-14" />
              </div>
            ) : data.activity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-10 text-center">
                <Megaphone
                  className="mx-auto h-8 w-8 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-semibold text-[var(--admin-on-surface)]">
                  No recent messaging activity
                </p>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Send a campaign or schedule a message to populate this feed.
                </p>
              </div>
            ) : (
              <ul className="space-y-5">
                {data.activity.map((item, index) => {
                  const Icon = activityIcon(item.kind);
                  const isLast = index === data.activity.length - 1;
                  return (
                    <li key={item.id} className="flex gap-4">
                      <div className="relative">
                        <div
                          className={`relative z-[1] flex h-8 w-8 items-center justify-center rounded-full ${activityTone(item.kind)}`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        </div>
                        {!isLast ? (
                          <span className="absolute left-1/2 top-8 h-[calc(100%+0.75rem)] w-0.5 -translate-x-1/2 bg-[var(--admin-outline)]" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <Link
                          href={item.href}
                          prefetch={false}
                          className="text-sm text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                        >
                          <span className="font-semibold">{item.title}</span>
                          <span className="text-[var(--admin-on-surface-variant)]">
                            {" "}
                            · {item.detail}
                          </span>
                        </Link>
                        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                          {formatRelativeTime(item.at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
