"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Code2,
  Copy,
  ExternalLink,
  KeyRound,
  Plus,
  RefreshCw,
  School,
  ShoppingCart,
  UserPlus,
  Webhook,
  X,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  INTEGRATION_EVENT_HINTS,
  INTEGRATIONS_HREF,
  MARKETING_HREF,
  deliveryStatusTone,
  formatIntegrationDateTime,
  formatIntegrationRelativeTime,
  isLiveIntegrationEvent,
  type MarketingIntegrationCredentialsDto,
  type MarketingIntegrationDeliveryDto,
  type MarketingIntegrationEventGroup,
  type MarketingIntegrationEventKey,
  type MarketingIntegrationOverviewDto,
  type MarketingIntegrationSnippetsDto,
  type MarketingIntegrationWebhookDto,
} from "./integrations-shared";

const DASHBOARD_HREF = "/admin";

type TabId = "overview" | "webhooks" | "snippets" | "credentials";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "webhooks", label: "Webhooks" },
  { id: "snippets", label: "Code Snippets" },
  { id: "credentials", label: "App Credentials" },
];

type OverviewResponse = { data: MarketingIntegrationOverviewDto };
type SnippetsResponse = { data: MarketingIntegrationSnippetsDto };
type WebhooksResponse = { data: { events: MarketingIntegrationEventGroup[] } };
type CredentialsResponse = { data: MarketingIntegrationCredentialsDto };
type RotateResponse = {
  data: MarketingIntegrationCredentialsDto & { apiKey: string };
};
type WebhookResponse = { data: MarketingIntegrationWebhookDto };
type TestResponse = { data: { ok: boolean; message: string; statusCode: number | null } };
type DeliveriesResponse = { data: { items: MarketingIntegrationDeliveryDto[] } };

const EMPTY_OVERVIEW: MarketingIntegrationOverviewDto = {
  webhookCount: 0,
  webhookEnabledCount: 0,
  webhooksWithDelivery: 0,
  webhooksLastOkCount: 0,
  webhooksLastErrorCount: 0,
  snippetConfiguredCount: 0,
  apiKeyConfigured: false,
  apiKeyCreatedAt: null,
  lastDeliveryAt: null,
  health: "idle",
};

function copyText(value: string, label: string) {
  void navigator.clipboard.writeText(value).then(
    () => {
      toast.success(`${label} copied.`);
    },
    () => {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    },
  );
}

function eventIcon(key: MarketingIntegrationEventKey) {
  if (key === "sign_up") return UserPlus;
  if (key === "purchase") return ShoppingCart;
  if (key === "lesson_completed") return School;
  return Webhook;
}

function StatusPill({
  tone,
  label,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  label: string;
}) {
  const className =
    tone === "success"
      ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
      : tone === "warning"
        ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
        : tone === "danger"
          ? "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]"
          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  );
}

function deliveryLabel(hook: MarketingIntegrationWebhookDto): {
  tone: "success" | "warning" | "danger" | "neutral";
  label: string;
} {
  if (!hook.lastDeliveryStatus) {
    return { tone: "neutral", label: "Never delivered" };
  }
  const tone = deliveryStatusTone(hook.lastDeliveryStatus);
  if (hook.lastDeliveryStatus.startsWith("ok:")) {
    const code = hook.lastDeliveryStatus.slice(3);
    return { tone, label: code ? `Delivered (${code})` : "Delivered" };
  }
  if (hook.lastDeliveryStatus.startsWith("error:")) {
    const detail = hook.lastDeliveryStatus.slice(6);
    const short = detail.length > 28 ? `${detail.slice(0, 28)}…` : detail;
    return { tone, label: short || "Failed" };
  }
  return { tone: "warning", label: hook.lastDeliveryStatus };
}

function healthLabel(health: MarketingIntegrationOverviewDto["health"]): {
  tone: "success" | "warning" | "neutral";
  label: string;
} {
  if (health === "healthy") return { tone: "success", label: "Healthy" };
  if (health === "attention") return { tone: "warning", label: "Needs attention" };
  return { tone: "neutral", label: "Not configured" };
}

function ToggleSwitch(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.ariaLabel}
      disabled={props.disabled}
      onClick={(event) => {
        event.stopPropagation();
        props.onChange(!props.checked);
      }}
      className={[
        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
        props.checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-[var(--admin-surface)] transition-transform duration-200",
          props.checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
        aria-hidden="true"
      />
    </button>
  );
}

export function IntegrationsHubPanel() {
  const [tab, setTab] = useState<TabId>("overview");
  const [overview, setOverview] = useState<MarketingIntegrationOverviewDto>(EMPTY_OVERVIEW);
  const [snippets, setSnippets] = useState<MarketingIntegrationSnippetsDto | null>(null);
  const [events, setEvents] = useState<MarketingIntegrationEventGroup[]>([]);
  const [credentials, setCredentials] = useState<MarketingIntegrationCredentialsDto | null>(null);
  const [freshApiKey, setFreshApiKey] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSnippets, setSavingSnippets] = useState(false);
  const [siteBodyHtml, setSiteBodyHtml] = useState("");
  const [orderTrackingHtml, setOrderTrackingHtml] = useState("");
  const [signupTrackingHtml, setSignupTrackingHtml] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<MarketingIntegrationEventKey>("sign_up");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [addEndpointOpen, setAddEndpointOpen] = useState(false);
  const [webhookBusy, setWebhookBusy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logWebhook, setLogWebhook] = useState<MarketingIntegrationWebhookDto | null>(null);
  const [deliveries, setDeliveries] = useState<MarketingIntegrationDeliveryDto[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, snippetsRes, webhooksRes, credentialsRes] = await Promise.all([
        clientApi.get<OverviewResponse>("/api/v1/marketing/integrations/overview"),
        clientApi.get<SnippetsResponse>("/api/v1/marketing/integrations/snippets"),
        clientApi.get<WebhooksResponse>("/api/v1/marketing/integrations/webhooks"),
        clientApi.get<CredentialsResponse>("/api/v1/marketing/integrations/credentials"),
      ]);
      setOverview(overviewRes.data);
      setSnippets(snippetsRes.data);
      setSiteBodyHtml(snippetsRes.data.siteBodyHtml ?? "");
      setOrderTrackingHtml(snippetsRes.data.orderTrackingHtml ?? "");
      setSignupTrackingHtml(snippetsRes.data.signupTrackingHtml ?? "");
      setEvents(webhooksRes.data.events);
      setCredentials(credentialsRes.data);
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load integrations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const flatWebhooks = useMemo(() => {
    const rows: Array<{
      event: MarketingIntegrationEventGroup;
      hook: MarketingIntegrationWebhookDto;
    }> = [];
    for (const event of events) {
      for (const hook of event.webhooks) {
        rows.push({ event, hook });
      }
    }
    return rows;
  }, [events]);

  const reservedWithoutHooks = useMemo(
    () =>
      events.filter((event) => !isLiveIntegrationEvent(event.key) && event.webhooks.length === 0),
    [events],
  );

  const eventOptions = useMemo(
    () =>
      events.map((event) => ({
        value: event.key,
        label: isLiveIntegrationEvent(event.key) ? event.label : `${event.label} (reserved)`,
      })),
    [events],
  );

  async function saveSnippets() {
    setSavingSnippets(true);
    try {
      const response = await clientApi.put<SnippetsResponse>(
        "/api/v1/marketing/integrations/snippets",
        {
          siteBodyHtml,
          orderTrackingHtml,
          signupTrackingHtml,
        },
        "marketing-integrations-snippets-save",
        { successMessage: "Code snippets saved." },
      );
      setSnippets(response.data);
      await loadAll();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save snippets.");
    } finally {
      setSavingSnippets(false);
    }
  }

  async function confirmRotateApiKey() {
    setWebhookBusy("rotate");
    try {
      const response = await clientApi.post<RotateResponse>(
        "/api/v1/marketing/integrations/credentials",
        {},
        "marketing-integrations-rotate-key",
        {
          successMessage: "API key generated. Copy it now; it will not be shown again.",
        },
      );
      setFreshApiKey(response.data.apiKey);
      setRevealKey(true);
      setCredentials({
        schoolId: response.data.schoolId,
        tenantSlug: response.data.tenantSlug,
        apiKeyConfigured: true,
        apiKeyPrefix: response.data.apiKeyPrefix,
        apiKeyCreatedAt: response.data.apiKeyCreatedAt,
      });
      setRotateOpen(false);
      setOverview((current) => ({
        ...current,
        apiKeyConfigured: true,
        apiKeyCreatedAt: response.data.apiKeyCreatedAt,
      }));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not rotate API key.");
    } finally {
      setWebhookBusy(null);
    }
  }

  async function addWebhook() {
    if (!newWebhookUrl.trim()) {
      toast.error("Paste a webhook URL first.");
      return;
    }
    setWebhookBusy("add");
    try {
      await clientApi.post<WebhookResponse>(
        "/api/v1/marketing/integrations/webhooks",
        { eventKey: selectedEvent, url: newWebhookUrl.trim(), enabled: true },
        "marketing-integrations-webhook-add",
        { successMessage: "Webhook endpoint added." },
      );
      setNewWebhookUrl("");
      setAddEndpointOpen(false);
      await loadAll();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not add webhook.");
    } finally {
      setWebhookBusy(null);
    }
  }

  async function testWebhook(id: string) {
    setWebhookBusy(id);
    try {
      const response = await clientApi.post<TestResponse>(
        `/api/v1/marketing/integrations/webhooks/${id}/test`,
        {},
        "marketing-integrations-webhook-test",
      );
      if (response.data.ok) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
      await loadAll();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Webhook test failed.");
    } finally {
      setWebhookBusy(null);
    }
  }

  async function deleteWebhook(id: string) {
    setWebhookBusy(id);
    try {
      await clientApi.delete(
        `/api/v1/marketing/integrations/webhooks/${id}`,
        "marketing-integrations-webhook-delete",
        undefined,
        { successMessage: "Webhook removed." },
      );
      if (expandedId === id) setExpandedId(null);
      if (logWebhook?.id === id) {
        setLogWebhook(null);
        setDeliveries([]);
      }
      await loadAll();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete webhook.");
    } finally {
      setWebhookBusy(null);
    }
  }

  async function toggleWebhook(id: string, enabled: boolean) {
    setWebhookBusy(id);
    try {
      await clientApi.patch(
        `/api/v1/marketing/integrations/webhooks/${id}`,
        { enabled },
        "marketing-integrations-webhook-toggle",
        { successMessage: enabled ? "Webhook enabled." : "Webhook disabled." },
      );
      await loadAll();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not update webhook.");
    } finally {
      setWebhookBusy(null);
    }
  }

  async function openDeliveryLog(hook: MarketingIntegrationWebhookDto) {
    setLogWebhook(hook);
    setDeliveriesLoading(true);
    setDeliveries([]);
    try {
      const response = await clientApi.get<DeliveriesResponse>(
        `/api/v1/marketing/integrations/webhooks/${hook.id}/deliveries`,
      );
      setDeliveries(response.data.items);
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load delivery log.",
      );
    } finally {
      setDeliveriesLoading(false);
    }
  }

  const webhookHealth = healthLabel(overview.health);
  const snippetTone =
    overview.snippetConfiguredCount >= 3
      ? ("success" as const)
      : overview.snippetConfiguredCount > 0
        ? ("warning" as const)
        : ("neutral" as const);
  const snippetStatusLabel =
    overview.snippetConfiguredCount >= 3
      ? "Complete"
      : overview.snippetConfiguredCount > 0
        ? "Partial setup"
        : "Not set";
  const apiKeyTone = overview.apiKeyConfigured ? ("success" as const) : ("neutral" as const);

  const maskedKey = credentials?.apiKeyConfigured
    ? `${credentials.apiKeyPrefix ?? "atk_"}********************************`
    : "Not generated";
  const displayedKey = freshApiKey
    ? revealKey
      ? freshApiKey
      : "•".repeat(Math.min(40, freshApiKey.length))
    : maskedKey;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={DASHBOARD_HREF} className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]">/</span>
        <Link href={MARKETING_HREF} className={generalSettingsBackLinkClassName}>
          Marketing
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]">/</span>
        <span className="font-medium text-[var(--admin-on-surface)]">Integrations</span>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-[-0.01em] text-[var(--admin-on-surface)] md:text-[28px]">
            Integrations
          </h1>
          <p className="mt-1 text-[14px] text-[var(--admin-on-surface-variant)]">
            Manage webhooks, tracking snippets, and API credentials for your data pipelines.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
          onClick={() => void loadAll()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <div className="flex border-b border-[var(--admin-border)]">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
              }}
              className={[
                "px-5 py-3 text-xs font-semibold tracking-wide transition-colors motion-safe:duration-200",
                active
                  ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                  : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-40 animate-pulse rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : null}

      {!loading && tab === "overview" ? (
        <section className="space-y-6 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <article className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="inline-flex rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] p-2 text-[var(--admin-primary)]">
                  <Webhook className="h-5 w-5" aria-hidden="true" />
                </span>
                <StatusPill tone={webhookHealth.tone} label={webhookHealth.label} />
              </div>
              <p className="mb-1 text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                Active webhooks
              </p>
              <p className="text-[32px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
                {overview.webhookEnabledCount}
              </p>
              <p className="mt-2 flex items-center gap-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                {overview.webhooksLastErrorCount > 0 ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--admin-warning)]" />
                    {overview.webhooksLastErrorCount} with last delivery error
                  </>
                ) : overview.webhooksLastOkCount > 0 ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--admin-success)]" />
                    {overview.webhooksLastOkCount} last delivery OK
                  </>
                ) : (
                  <>
                    {overview.webhookCount} configured
                    {overview.lastDeliveryAt
                      ? ` · last ${formatIntegrationRelativeTime(overview.lastDeliveryAt)}`
                      : " · no deliveries yet"}
                  </>
                )}
              </p>
            </article>

            <article className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="inline-flex rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] p-2 text-[var(--admin-primary)]">
                  <Code2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <StatusPill tone={snippetTone} label={snippetStatusLabel} />
              </div>
              <p className="mb-1 text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                Tracking snippets
              </p>
              <p className="text-[32px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
                {overview.snippetConfiguredCount} / 3
              </p>
              <p className="mt-2 text-[13px] text-[var(--admin-on-surface-variant)]">
                {overview.snippetConfiguredCount >= 3
                  ? "Site, order, and sign-up snippets are set."
                  : overview.snippetConfiguredCount === 0
                    ? "No tracking snippets configured yet."
                    : "Some snippet slots are still empty."}
              </p>
            </article>

            <article className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="inline-flex rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] p-2 text-[var(--admin-primary)]">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <StatusPill
                  tone={apiKeyTone}
                  label={overview.apiKeyConfigured ? "Active" : "Missing"}
                />
              </div>
              <p className="mb-1 text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                API key status
              </p>
              <p className="text-[32px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
                {overview.apiKeyConfigured ? "Generated" : "None"}
              </p>
              <p className="mt-2 text-[13px] text-[var(--admin-on-surface-variant)]">
                {overview.apiKeyCreatedAt
                  ? `Last rotated: ${formatIntegrationDateTime(overview.apiKeyCreatedAt)}`
                  : "Generate a key for inbound Zapier / Pabbly actions."}
              </p>
            </article>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold text-[var(--admin-primary)]">
                Connect your automation stack
              </h2>
              <p className="mt-2 max-w-2xl text-[14px] text-[var(--admin-on-surface-variant)]">
                Sign Up and Purchase events dispatch today. Other event types can be registered now
                and will fire when those product hooks ship.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-primary)] px-4 py-2 text-xs font-semibold text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)]"
                onClick={() => {
                  setTab("webhooks");
                }}
              >
                Configure webhooks
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                onClick={() => {
                  setTab("credentials");
                }}
              >
                View credentials
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && tab === "webhooks" ? (
        <section className="space-y-4 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--admin-on-surface)]">
                Subscription events
              </h2>
              <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                Outbound POST payloads for learner lifecycle events.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-primary)] hover:underline"
              onClick={() => {
                setAddEndpointOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add endpoint
            </button>
          </div>

          {flatWebhooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-14 text-center">
              <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                No webhook endpoints yet
              </p>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Add a Zapier, Pabbly, or custom HTTPS URL to start receiving events.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--admin-primary)] px-4 py-2 text-xs font-semibold text-[var(--admin-on-primary)]"
                onClick={() => {
                  setAddEndpointOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add endpoint
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {flatWebhooks.map(({ event, hook }) => {
                const Icon = eventIcon(event.key);
                const status = deliveryLabel(hook);
                const open = expandedId === hook.id;
                return (
                  <div
                    key={hook.id}
                    className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setExpandedId(open ? null : hook.id);
                      }}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                          keyboardEvent.preventDefault();
                          setExpandedId(open ? null : hook.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <Icon
                          className="h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-[var(--admin-on-surface)]">
                            {event.label}
                            {!isLiveIntegrationEvent(event.key) ? (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                                Reserved
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                            {hook.url}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-6">
                        <div className="hidden flex-col items-end sm:flex">
                          <StatusPill tone={status.tone} label={status.label} />
                          <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                            {formatIntegrationRelativeTime(hook.lastDeliveryAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <ToggleSwitch
                            checked={hook.enabled}
                            disabled={webhookBusy === hook.id}
                            ariaLabel={`${hook.enabled ? "Disable" : "Enable"} ${event.label} webhook`}
                            onChange={(next) => {
                              void toggleWebhook(hook.id, next);
                            }}
                          />
                          <ChevronDown
                            className={[
                              "h-5 w-5 text-[var(--admin-on-surface-variant)] transition-transform duration-200",
                              open ? "rotate-180" : "",
                            ].join(" ")}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </div>
                    {open ? (
                      <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                        <p className="mb-3 text-[13px] text-[var(--admin-on-surface-variant)]">
                          {INTEGRATION_EVENT_HINTS[event.key]}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] disabled:opacity-50"
                              disabled={webhookBusy === hook.id}
                              onClick={() => void testWebhook(hook.id)}
                            >
                              Test &amp; save
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] disabled:opacity-50"
                              disabled={webhookBusy === hook.id}
                              onClick={() => void deleteWebhook(hook.id)}
                            >
                              Remove
                            </button>
                          </div>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                            onClick={() => void openDeliveryLog(hook)}
                          >
                            View delivery log
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {reservedWithoutHooks.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 opacity-80">
                  <div className="flex items-center gap-3">
                    <Webhook className="h-5 w-5 text-[var(--admin-on-surface-variant)]" />
                    <p className="text-[12px] font-semibold text-[var(--admin-on-surface)]">
                      {reservedWithoutHooks.length} reserved event
                      {reservedWithoutHooks.length === 1 ? "" : "s"} available for early
                      configuration
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                    onClick={() => {
                      const first = reservedWithoutHooks[0];
                      if (first) setSelectedEvent(first.key);
                      setAddEndpointOpen(true);
                    }}
                  >
                    Add endpoint
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === "snippets" ? (
        <section className="space-y-6 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]" />
            <div>
              <p className="text-[12px] font-semibold text-[var(--admin-warning)]">
                Caution: trusted HTML only
              </p>
              <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                Only paste snippets from sources you trust. Malicious code can expose learner data
                or compromise your school site.
              </p>
            </div>
          </div>

          <SnippetEditor
            title="Site-wide tracking"
            description="Place this in the head or body of every page for analytics and chat widgets."
            value={siteBodyHtml}
            onChange={setSiteBodyHtml}
          />
          <SnippetEditor
            title="Order tracking"
            description="Add to your thank-you / checkout success page to attribute purchases."
            value={orderTrackingHtml}
            onChange={setOrderTrackingHtml}
          />
          <SnippetEditor
            title="Sign-up tracking"
            description="Triggered when a new learner creates an account."
            value={signupTrackingHtml}
            onChange={setSignupTrackingHtml}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              {snippets?.updatedAt
                ? `Last saved ${formatIntegrationDateTime(snippets.updatedAt)}`
                : "Not saved yet"}
            </p>
            <button
              type="button"
              className="rounded-xl bg-[var(--admin-primary)] px-4 py-2 text-xs font-semibold text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
              disabled={savingSnippets}
              onClick={() => void saveSnippets()}
            >
              {savingSnippets ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && tab === "credentials" ? (
        <section className="motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <article className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <h2 className="mb-4 text-[18px] font-semibold text-[var(--admin-on-surface)]">
                General identifiers
              </h2>
              <div className="space-y-4">
                <CredentialField
                  label="School ID"
                  value={credentials?.schoolId ?? ""}
                  onCopy={() => {
                    if (credentials?.schoolId) copyText(credentials.schoolId, "School ID");
                  }}
                />
                <CredentialField
                  label="Tenant slug"
                  value={credentials?.tenantSlug ?? ""}
                  onCopy={() => {
                    if (credentials?.tenantSlug) copyText(credentials.tenantSlug, "Tenant slug");
                  }}
                />
              </div>
              <p className="mt-5 text-[13px] text-[var(--admin-on-surface-variant)]">
                Use with inbound actions{" "}
                <code className="rounded bg-[var(--admin-surface-high)] px-1 font-mono text-[11px]">
                  sign-up
                </code>{" "}
                and{" "}
                <code className="rounded bg-[var(--admin-surface-high)] px-1 font-mono text-[11px]">
                  paid-enrollment
                </code>{" "}
                plus header{" "}
                <code className="rounded bg-[var(--admin-surface-high)] px-1 font-mono text-[11px]">
                  x-atlas-integration-key
                </code>
                .
              </p>
            </article>

            <article className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <div className="mb-4">
                <h2 className="text-[18px] font-semibold text-[var(--admin-on-surface)]">
                  API authentication
                </h2>
                <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                  {credentials?.apiKeyCreatedAt
                    ? `Last rotated ${formatIntegrationDateTime(credentials.apiKeyCreatedAt)}`
                    : "No secret key generated yet"}
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>Secret API key</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      type={freshApiKey && revealKey ? "text" : "password"}
                      value={displayedKey}
                      className={`${MESSENGER_WIZARD_FIELD_CLASS} font-mono text-xs`}
                    />
                    {freshApiKey ? (
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--admin-border)] px-3 transition-colors hover:bg-[var(--admin-surface-high)]"
                        onClick={() => {
                          setRevealKey((current) => !current);
                        }}
                        aria-label={revealKey ? "Hide API key" : "Reveal API key"}
                      >
                        {revealKey ? "Hide" : "Show"}
                      </button>
                    ) : null}
                    {freshApiKey ? (
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--admin-border)] px-3 transition-colors hover:bg-[var(--admin-surface-high)]"
                        onClick={() => {
                          copyText(freshApiKey, "API key");
                        }}
                        aria-label="Copy API key"
                      >
                        <Copy className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {freshApiKey ? (
                  <p className="rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-3 py-2 text-[13px] text-[var(--admin-on-surface)]">
                    Copy this key now. It will not be shown again after you leave this page.
                  </p>
                ) : null}

                <div className="border-t border-[var(--admin-border)] pt-4">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-danger)] hover:underline disabled:opacity-50"
                    disabled={webhookBusy === "rotate"}
                    onClick={() => {
                      setRotateOpen(true);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {credentials?.apiKeyConfigured ? "Rotate secret key" : "Generate secret key"}
                  </button>
                  <p className="mt-2 text-[10px] text-[var(--admin-on-surface-variant)]">
                    Rotating immediately invalidates the existing key.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        Path: <span className="font-mono">{INTEGRATIONS_HREF}</span>
      </p>

      {addEndpointOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => {
            if (webhookBusy !== "add") setAddEndpointOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="integrations-add-endpoint-title"
            className={`admin-theme w-full max-w-lg space-y-4 bg-[var(--admin-surface)] p-6 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2
              id="integrations-add-endpoint-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Add webhook endpoint
            </h2>
            <AdminSelectDropdown
              id="integrations-event-key"
              label="Event"
              ariaLabel="Webhook event"
              value={selectedEvent}
              options={eventOptions}
              onChange={(value) => {
                setSelectedEvent(value as MarketingIntegrationEventKey);
              }}
            />
            <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
              {INTEGRATION_EVENT_HINTS[selectedEvent]}
            </p>
            <div>
              <label htmlFor="integrations-webhook-url" className={MESSENGER_WIZARD_LABEL_CLASS}>
                Endpoint URL
              </label>
              <input
                id="integrations-webhook-url"
                value={newWebhookUrl}
                onChange={(event) => {
                  setNewWebhookUrl(event.target.value);
                }}
                placeholder="https://hooks.example.com/catch/..."
                className={`${MESSENGER_WIZARD_FIELD_CLASS} font-mono text-xs`}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                disabled={webhookBusy === "add"}
                onClick={() => {
                  setAddEndpointOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={webhookBusy === "add"}
                onClick={() => void addWebhook()}
              >
                {webhookBusy === "add" ? "Adding..." : "Add endpoint"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {logWebhook ? (
        <div className="fixed inset-0 z-[60]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] backdrop-blur-[4px]"
            aria-label="Close delivery log"
            onClick={() => {
              setLogWebhook(null);
              setDeliveries([]);
            }}
          />
          <aside
            className="admin-theme absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="integrations-delivery-log-title"
          >
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] p-6">
              <div>
                <h2
                  id="integrations-delivery-log-title"
                  className="text-[18px] font-semibold text-[var(--admin-on-surface)]"
                >
                  Delivery log
                </h2>
                <p className="mt-1 truncate font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                  {logWebhook.url}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-[var(--admin-surface-high)]"
                aria-label="Close"
                onClick={() => {
                  setLogWebhook(null);
                  setDeliveries([]);
                }}
              >
                <X className="h-5 w-5 text-[var(--admin-on-surface-variant)]" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {deliveriesLoading ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
              ) : null}
              {!deliveriesLoading && deliveries.length === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  No delivery attempts recorded yet. Run Test &amp; save to create the first entry.
                </p>
              ) : null}
              {deliveries.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 transition-colors hover:border-[color-mix(in_srgb,var(--admin-primary)_30%,var(--admin-border))]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <StatusPill
                      tone={item.ok ? "success" : "danger"}
                      label={
                        item.statusCode != null
                          ? `${item.statusCode} ${item.ok ? "OK" : "ERROR"}`
                          : item.ok
                            ? "OK"
                            : "ERROR"
                      }
                    />
                    <span className="text-[10px] text-[var(--admin-on-surface-variant)]">
                      {formatIntegrationRelativeTime(item.createdAt)}
                      {item.source === "test" ? " · test" : ""}
                    </span>
                  </div>
                  <p className="mb-2 font-mono text-[11px] text-[var(--admin-on-surface)]">
                    POST {safePath(item.url)}
                  </p>
                  <p className="mb-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                    {item.message}
                  </p>
                  {item.requestBody ? (
                    <pre className="overflow-x-auto rounded-lg bg-[color-mix(in_srgb,var(--admin-on-surface)_88%,var(--admin-surface))] p-3 font-mono text-[10px] text-[var(--admin-surface)]">
                      {prettyJson(item.requestBody)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {rotateOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => {
            if (webhookBusy !== "rotate") setRotateOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="integrations-rotate-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-6 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2
              id="integrations-rotate-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              {credentials?.apiKeyConfigured ? "Rotate API key?" : "Generate API key?"}
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {credentials?.apiKeyConfigured
                ? "This action is permanent. Any app using the current key will lose connectivity immediately."
                : "A new secret key will be shown once. Store it in your automation tool before leaving this page."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                disabled={webhookBusy === "rotate"}
                onClick={() => {
                  setRotateOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={webhookBusy === "rotate"}
                onClick={() => void confirmRotateApiKey()}
              >
                {webhookBusy === "rotate"
                  ? "Working..."
                  : credentials?.apiKeyConfigured
                    ? "Yes, rotate key"
                    : "Generate key"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SnippetEditor(props: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
      <h3 className="text-[18px] font-semibold text-[var(--admin-on-surface)]">{props.title}</h3>
      <p className="mt-2 mb-4 text-[13px] text-[var(--admin-on-surface-variant)]">
        {props.description}
      </p>
      <textarea
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
        rows={7}
        spellCheck={false}
        className="min-h-[120px] w-full resize-y rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-on-surface)_88%,var(--admin-surface))] p-4 font-mono text-[12px] leading-relaxed text-[var(--admin-surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25"
        placeholder={"<!-- paste trusted script here -->"}
      />
    </div>
  );
}

function CredentialField(props: {
  label: string;
  value: string;
  onCopy?: (() => void) | undefined;
}) {
  return (
    <div>
      <label className={MESSENGER_WIZARD_LABEL_CLASS}>{props.label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={props.value || "-"}
          className={`${MESSENGER_WIZARD_FIELD_CLASS} cursor-default font-mono text-xs`}
        />
        {props.onCopy && props.value ? (
          <button
            type="button"
            className="rounded-xl border border-[var(--admin-border)] px-3 transition-colors hover:bg-[var(--admin-surface-high)]"
            onClick={props.onCopy}
            aria-label={`Copy ${props.label}`}
          >
            <Copy className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function safePath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || "/";
  } catch {
    return url;
  }
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
