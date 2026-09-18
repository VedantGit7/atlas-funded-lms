"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Columns3,
  Inbox,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  Search,
  Unplug,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { SubSchoolsEmptyIllustration } from "../sub-schools/SubSchoolsEmptyIllustration";
import {
  manageDangerButtonClassName,
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
  manageStatusChipClassName,
} from "../manage/manage-ui-shared";
import {
  formatWhatsappDateTime,
  WHATSAPP_CREATE_HREF,
  WHATSAPP_INBOX_HREF,
  WHATSAPP_TEMPLATES_HREF,
  whatsappCampaignHref,
  type CampaignDto,
  type ConnectionDto,
  type WhatsappCampaignStatus,
} from "./whatsapp-shared";

const MESSENGER_HREF = "/admin/marketing/messenger";

type StatusTab = "ALL" | WhatsappCampaignStatus;
type ColumnId = "title" | "status" | "audience" | "created" | "actions";
type ConnectTab = "mock" | "meta";

const TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "ALL" },
  { id: "SENT", label: "SENT" },
  { id: "SCHEDULED", label: "SCHEDULED" },
  { id: "DRAFT", label: "DRAFT" },
];

const COLUMNS: ReadonlyArray<{ id: ColumnId; label: string }> = [
  { id: "title", label: "Title" },
  { id: "status", label: "Status" },
  { id: "audience", label: "Audience" },
  { id: "created", label: "Created On" },
  { id: "actions", label: "" },
];

const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--admin-on-surface)]";

type ConnectionResponse = { data: ConnectionDto };
type ListResponse = { data: { items: CampaignDto[] } };

function statusTone(status: WhatsappCampaignStatus): "success" | "primary" | "neutral" {
  if (status === "SENT") return "success";
  if (status === "SCHEDULED") return "primary";
  return "neutral";
}

export function WhatsappListPanel() {
  const router = useRouter();
  const [connection, setConnection] = useState<ConnectionDto | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectTab, setConnectTab] = useState<ConnectTab>("mock");
  const [connectBusy, setConnectBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const [mockDisplayName, setMockDisplayName] = useState("");
  const [mockPhone, setMockPhone] = useState("");
  const [metaDisplayName, setMetaDisplayName] = useState("");
  const [metaPhone, setMetaPhone] = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaWabaId, setMetaWabaId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");

  const [tab, setTab] = useState<StatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<CampaignDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<ColumnId>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [createdOnOpen, setCreatedOnOpen] = useState(false);
  const [createdOn, setCreatedOn] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<CampaignDto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const createdOnRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadConnection = useCallback(async () => {
    setConnectionLoading(true);
    try {
      const response = await clientApi.get<ConnectionResponse>(
        "/api/v1/marketing/whatsapp/connection",
      );
      setConnection(response.data);
    } catch (caught) {
      setConnection(null);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load WhatsApp connection.",
      );
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  const loadCampaigns = useCallback(async () => {
    if (connection?.status !== "CONNECTED") return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", "50");
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (createdOn) params.set("createdOn", createdOn);
      const response = await clientApi.get<ListResponse>(
        `/api/v1/marketing/whatsapp/campaigns?${params.toString()}`,
      );
      setItems(response.data.items);
    } catch (caught) {
      setItems([]);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load WhatsApp campaigns.",
      );
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery, createdOn, connection?.status]);

  useEffect(() => {
    if (connection?.status === "CONNECTED") {
      void loadCampaigns();
    }
  }, [loadCampaigns, connection?.status]);

  useEffect(() => {
    if (!columnsOpen && !createdOnOpen && !menuId && !moreOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (columnsOpen && !columnsRef.current?.contains(target)) setColumnsOpen(false);
      if (createdOnOpen && !createdOnRef.current?.contains(target)) setCreatedOnOpen(false);
      if (menuId && !menuRef.current?.contains(target)) setMenuId(null);
      if (moreOpen && !moreRef.current?.contains(target)) setMoreOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setColumnsOpen(false);
        setCreatedOnOpen(false);
        setMenuId(null);
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [columnsOpen, createdOnOpen, menuId, moreOpen]);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((column) => !hidden.has(column.id)),
    [hidden],
  );

  function toggleColumn(id: ColumnId) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (id !== "title" && id !== "actions" && visibleColumns.length > 2) next.add(id);
      return next;
    });
  }

  async function connectMock() {
    if (!mockDisplayName.trim() || !mockPhone.trim()) {
      toast.error("Display name and phone number are required.");
      return;
    }
    setConnectBusy(true);
    try {
      const response = await clientApi.post<ConnectionResponse>(
        "/api/v1/marketing/whatsapp/connection/mock",
        { displayName: mockDisplayName.trim(), phoneNumber: mockPhone.trim() },
        "whatsapp-connect-mock",
      );
      setConnection(response.data);
      toast.success("WhatsApp connected (mock).");
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not connect WhatsApp.",
      );
    } finally {
      setConnectBusy(false);
    }
  }

  async function connectMeta() {
    if (
      !metaDisplayName.trim() ||
      !metaPhone.trim() ||
      !metaPhoneNumberId.trim() ||
      !metaWabaId.trim() ||
      !metaAccessToken.trim()
    ) {
      toast.error("All Meta connection fields are required.");
      return;
    }
    setConnectBusy(true);
    try {
      const response = await clientApi.post<ConnectionResponse>(
        "/api/v1/marketing/whatsapp/connection/meta",
        {
          displayName: metaDisplayName.trim(),
          phoneNumber: metaPhone.trim(),
          phoneNumberId: metaPhoneNumberId.trim(),
          wabaId: metaWabaId.trim(),
          accessToken: metaAccessToken.trim(),
        },
        "whatsapp-connect-meta",
      );
      setConnection(response.data);
      toast.success("WhatsApp connected via Meta.");
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not connect WhatsApp.",
      );
    } finally {
      setConnectBusy(false);
    }
  }

  async function disconnect() {
    setConnectBusy(true);
    try {
      await clientApi.post(
        "/api/v1/marketing/whatsapp/connection/disconnect",
        {},
        "whatsapp-disconnect",
      );
      setConnection({
        status: "DISCONNECTED",
        providerMode: "mock",
        displayName: null,
        phoneNumber: null,
        phoneNumberId: null,
        wabaId: null,
        accessTokenLast4: null,
        qualityRating: null,
        messagingLimit: 0,
        connectedAt: null,
        hasCredentials: false,
      });
      setMoreOpen(false);
      toast.success("WhatsApp disconnected.");
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not disconnect WhatsApp.",
      );
    } finally {
      setConnectBusy(false);
    }
  }

  async function deleteCampaign() {
    if (!deleteRow) return;
    if (deleteConfirm !== deleteRow.title) {
      toast.error("Type the exact title to confirm deletion.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/whatsapp/campaigns/${deleteRow.id}/delete`,
        { titleConfirmation: deleteConfirm },
        `whatsapp-campaign-delete-${deleteRow.id}`,
      );
      setDeleteRow(null);
      await loadCampaigns();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete campaign.");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (connectionLoading) {
    return (
      <div className="space-y-4">
        <Link href={MESSENGER_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading WhatsApp…</p>
      </div>
    );
  }

  if (connection?.status !== "CONNECTED") {
    return (
      <div className="space-y-6">
        <Link href={MESSENGER_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={managePageTitleClassName}>WhatsApp</h1>
            <span className="rounded-md bg-[color-mix(in_srgb,var(--admin-warning)_22%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-warning)]">
              Beta
            </span>
          </div>
          <p className={`${managePageDescClassName} max-w-2xl`}>
            Connect a WhatsApp Business account to send marketing template messages and manage team
            inbox conversations.
          </p>
        </header>

        <section className="max-w-xl space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
          <h2 className="text-base font-bold text-[var(--admin-on-surface)]">Connect WhatsApp</h2>

          <div
            role="tablist"
            aria-label="Connection type"
            className="flex gap-4 border-b border-[var(--admin-border)]"
          >
            {(
              [
                ["mock", "Mock (dev)"],
                ["meta", "Meta Cloud API"],
              ] as const
            ).map(([id, label]) => {
              const active = connectTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setConnectTab(id);
                  }}
                  className={[
                    "relative -mb-px pb-2 text-sm font-semibold transition-colors",
                    active
                      ? "text-[var(--admin-primary)]"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                >
                  {label}
                  {active ? (
                    <span
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {connectTab === "mock" ? (
            <div className="space-y-4 pt-2">
              <label className="block">
                <span className={LABEL_CLASS}>Display name</span>
                <input
                  type="text"
                  value={mockDisplayName}
                  disabled={connectBusy}
                  onChange={(event) => {
                    setMockDisplayName(event.target.value);
                  }}
                  className={FIELD_CLASS}
                  placeholder="Academy Support"
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Phone number</span>
                <input
                  type="text"
                  value={mockPhone}
                  disabled={connectBusy}
                  onChange={(event) => {
                    setMockPhone(event.target.value);
                  }}
                  className={FIELD_CLASS}
                  placeholder="+15551234567"
                />
              </label>
              <button
                type="button"
                disabled={connectBusy}
                className={managePrimaryButtonClassName}
                onClick={() => {
                  void connectMock();
                }}
              >
                Connect (mock)
              </button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <label className="block">
                <span className={LABEL_CLASS}>Display name</span>
                <input
                  type="text"
                  value={metaDisplayName}
                  disabled={connectBusy}
                  onChange={(event) => {
                    setMetaDisplayName(event.target.value);
                  }}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Phone number</span>
                <input
                  type="text"
                  value={metaPhone}
                  disabled={connectBusy}
                  onChange={(event) => {
                    setMetaPhone(event.target.value);
                  }}
                  className={FIELD_CLASS}
                  placeholder="+15551234567"
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Phone number ID</span>
                <input
                  type="text"
                  value={metaPhoneNumberId}
                  disabled={connectBusy}
                  onChange={(event) => {
                    setMetaPhoneNumberId(event.target.value);
                  }}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>WABA ID</span>
                <input
                  type="text"
                  value={metaWabaId}
                  disabled={connectBusy}
                  onChange={(event) => {
                    setMetaWabaId(event.target.value);
                  }}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Access token</span>
                <input
                  type="password"
                  value={metaAccessToken}
                  disabled={connectBusy}
                  onChange={(event) => {
                    setMetaAccessToken(event.target.value);
                  }}
                  className={FIELD_CLASS}
                />
              </label>
              <button
                type="button"
                disabled={connectBusy}
                className={managePrimaryButtonClassName}
                onClick={() => {
                  void connectMeta();
                }}
              >
                Connect via Meta
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={MESSENGER_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={managePageTitleClassName}>WhatsApp</h1>
            <span className="rounded-md bg-[color-mix(in_srgb,var(--admin-warning)_22%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-warning)]">
              Beta
            </span>
          </div>
          <p className={`${managePageDescClassName} max-w-2xl`}>
            {connection.displayName ?? "Connected"} · {connection.phoneNumber ?? "—"}
            {connection.providerMode === "mock" ? " (mock)" : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={WHATSAPP_CREATE_HREF}
            prefetch={false}
            className={managePrimaryButtonClassName}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Message
          </Link>
          <div ref={moreRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              className={manageSecondaryButtonClassName}
              onClick={() => {
                setMoreOpen((open) => !open);
              }}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              More
            </button>
            {moreOpen ? (
              <div
                role="menu"
                className={[
                  "absolute right-0 z-20 w-52 origin-top-right bg-[var(--admin-surface)] p-1.5 shadow-lg",
                  dropdownPanelSurfaceClassName,
                ].join(" ")}
                style={{ top: "calc(100% + 6px)" }}
              >
                <Link
                  href={WHATSAPP_TEMPLATES_HREF}
                  prefetch={false}
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setMoreOpen(false);
                  }}
                >
                  <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                  Manage templates
                </Link>
                <Link
                  href={WHATSAPP_INBOX_HREF}
                  prefetch={false}
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setMoreOpen(false);
                  }}
                >
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                  Team Inbox
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  disabled={connectBusy}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--admin-danger)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    void disconnect();
                  }}
                >
                  <Unplug className="h-4 w-4" aria-hidden="true" />
                  Disconnect
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="WhatsApp campaign status"
        className="flex gap-6 border-b border-[var(--admin-border)]"
      >
        {TABS.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(entry.id);
              }}
              className={[
                "relative -mb-px pb-3 text-xs font-bold tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]",
                active
                  ? "text-[var(--admin-primary)]"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
            >
              {entry.label}
              {active ? (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--admin-primary)]"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search by Title"
            aria-label="Search by Title"
            className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div ref={columnsRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={columnsOpen}
              onClick={() => {
                setCreatedOnOpen(false);
                setColumnsOpen((open) => !open);
              }}
              className={manageSecondaryButtonClassName}
            >
              <Columns3 className="h-4 w-4" aria-hidden="true" />
              Columns
              <ChevronDown
                className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 motion-safe:duration-200 ${columnsOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            <div
              role="menu"
              aria-label="Toggle columns"
              className={[
                "absolute right-0 z-20 w-56 origin-top-right bg-[var(--admin-surface)] p-1.5 shadow-lg",
                dropdownPanelSurfaceClassName,
                "transition-[opacity,transform] duration-150 motion-safe:duration-150",
                columnsOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0",
              ].join(" ")}
              style={{ top: "calc(100% + 6px)" }}
            >
              {COLUMNS.filter((column) => column.id !== "actions").map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                >
                  <input
                    type="checkbox"
                    checked={!hidden.has(column.id)}
                    disabled={column.id === "title"}
                    onChange={() => {
                      toggleColumn(column.id);
                    }}
                    className="h-4 w-4 accent-[var(--admin-primary)]"
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </div>

          <div ref={createdOnRef} className="relative">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={createdOnOpen}
              onClick={() => {
                setColumnsOpen(false);
                setCreatedOnOpen((open) => !open);
              }}
              className={manageSecondaryButtonClassName}
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Created On
              <ChevronDown
                className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 motion-safe:duration-200 ${createdOnOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            <div
              className={[
                "absolute right-0 z-20 w-64 origin-top-right space-y-3 bg-[var(--admin-surface)] p-3 shadow-lg",
                dropdownPanelSurfaceClassName,
                "transition-[opacity,transform] duration-150 motion-safe:duration-150",
                createdOnOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0",
              ].join(" ")}
              style={{ top: "calc(100% + 6px)" }}
            >
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                  Filter by date
                </span>
                <input
                  type="date"
                  value={createdOn}
                  onChange={(event) => {
                    setCreatedOn(event.target.value);
                  }}
                  className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                />
              </label>
              {createdOn ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:underline"
                  onClick={() => {
                    setCreatedOn("");
                  }}
                >
                  Clear date
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--admin-on-surface-variant)]">
          Loading campaigns…
        </p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-16 text-center">
          <SubSchoolsEmptyIllustration />
          <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No results found</p>
          {query.trim() || createdOn || tab !== "ALL" ? (
            <button
              type="button"
              className="text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:underline"
              onClick={() => {
                setQuery("");
                setCreatedOn("");
                setTab("ALL");
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link
              href={WHATSAPP_CREATE_HREF}
              prefetch={false}
              className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
            >
              Create your first WhatsApp message
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--admin-border)] last:border-b-0"
                  >
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="px-4 py-3 text-[var(--admin-on-surface)]">
                        {column.id === "title" ? (
                          <Link
                            href={whatsappCampaignHref(row.id)}
                            prefetch={false}
                            className="font-semibold text-[var(--admin-primary)] hover:underline"
                          >
                            {row.title}
                          </Link>
                        ) : column.id === "status" ? (
                          <span className={manageStatusChipClassName(statusTone(row.status))}>
                            {row.status}
                          </span>
                        ) : column.id === "audience" ? (
                          (row.audienceLabel ?? "—")
                        ) : column.id === "created" ? (
                          formatWhatsappDateTime(row.createdAt)
                        ) : (
                          <div
                            ref={menuId === row.id ? menuRef : undefined}
                            className="relative flex justify-end"
                          >
                            <button
                              type="button"
                              aria-label={`Actions for ${row.title}`}
                              aria-haspopup="menu"
                              aria-expanded={menuId === row.id}
                              className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                              onClick={() => {
                                setMenuId((current) => (current === row.id ? null : row.id));
                              }}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {menuId === row.id ? (
                              <div
                                role="menu"
                                className={[
                                  "absolute right-0 z-20 w-44 origin-top-right bg-[var(--admin-surface)] p-1.5 shadow-lg",
                                  dropdownPanelSurfaceClassName,
                                ].join(" ")}
                                style={{ top: "calc(100% + 4px)" }}
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => {
                                    setMenuId(null);
                                    router.push(whatsappCampaignHref(row.id));
                                  }}
                                >
                                  {row.status === "DRAFT" ? "Continue" : "Open"}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--admin-danger)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => {
                                    setMenuId(null);
                                    setDeleteRow(row);
                                    setDeleteConfirm("");
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteRow ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close delete dialog"
            className="absolute inset-0 bg-[var(--admin-scrim)]"
            disabled={deleteBusy}
            onClick={() => {
              if (!deleteBusy) setDeleteRow(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete WhatsApp campaign"
            className="relative z-10 w-full max-w-md space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl"
          >
            <h2 className="text-lg font-bold text-[var(--admin-danger)]">Delete campaign</h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {deleteRow.title}
              </span>{" "}
              to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              disabled={deleteBusy}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={FIELD_CLASS}
              placeholder="Exact title"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                className={manageSecondaryButtonClassName}
                onClick={() => {
                  setDeleteRow(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || deleteConfirm !== deleteRow.title}
                className={manageDangerButtonClassName}
                onClick={() => {
                  void deleteCampaign();
                }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
