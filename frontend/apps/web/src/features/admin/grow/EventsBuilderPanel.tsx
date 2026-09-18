"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Image as ImageIcon,
  MapPin,
  Search,
  Users,
  Video,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  EVENTS_LIST_HREF,
  MARKETING_HREF,
  REMINDER_OPTIONS,
  countdownParts,
  eventStatusLabel,
  formatEventCount,
  formatEventDateTime,
  fromLocalInputValue,
  registrationSourceLabel,
  toLocalInputValue,
  type MarketingEventDto,
  type MarketingEventRegistrationDto,
  type MarketingEventStatus,
} from "./events-shared";
import { csvEscape } from "@/lib/export/csv";

type Tab = "details" | "registrations" | "publish";

const REG_PAGE_SIZE = 10;

function statusTone(status: MarketingEventStatus): "success" | "warning" | "neutral" {
  if (status === "LIVE") return "success";
  if (status === "UNPUBLISHED") return "warning";
  return "neutral";
}

function StatusChip({ status }: { status: MarketingEventStatus }) {
  const tone = statusTone(status);
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        tone === "success"
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : tone === "warning"
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {eventStatusLabel(status)}
    </span>
  );
}

type EventPreviewProps = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  joinUrl: string;
  coverImageUrl: string;
  registrationCount: number;
};

function EventPublicPreview({
  title,
  description,
  startsAt,
  endsAt,
  location,
  joinUrl,
  coverImageUrl,
  registrationCount,
}: EventPreviewProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((current) => current + 1);
    }, 30_000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const startsIso = fromLocalInputValue(startsAt) ?? startsAt;
  const countdown = countdownParts(startsIso);
  void tick;

  const displayTitle = title.trim() || "Event title";
  const displayDescription =
    description.trim() || "Add a description to tell visitors what this event covers.";
  const displayLocation = location.trim() || (joinUrl.trim() ? "Online" : "Location TBD");
  const endsLabel = endsAt.trim()
    ? formatEventDateTime(fromLocalInputValue(endsAt) ?? endsAt)
    : null;

  return (
    <div className="sticky top-4 space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        Public page preview
      </h3>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin-outline)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin-outline)] opacity-80" />
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin-outline)] opacity-60" />
            <div className="ml-2 h-6 flex-1 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-[10px] leading-6 text-[var(--admin-on-surface-variant)]">
              events/preview
            </div>
          </div>
        </div>

        <div className="bg-[var(--admin-surface-low)] p-4" style={{ colorScheme: "light" }}>
          <div
            className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm"
            style={{ colorScheme: "light" }}
          >
            {coverImageUrl.trim() ? (
              <div className="aspect-[21/9] w-full overflow-hidden bg-[var(--admin-surface-high)]">
                <img
                  src={coverImageUrl.trim()}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div
                className="flex aspect-[21/9] items-center justify-center bg-[var(--admin-surface-high)]"
                style={{ color: "GrayText" }}
              >
                <ImageIcon className="h-8 w-8 opacity-50" aria-hidden="true" />
              </div>
            )}

            <div className="space-y-4 p-5">
              <div>
                <h4 className="text-xl font-bold leading-tight" style={{ color: "CanvasText" }}>
                  {displayTitle}
                </h4>
                <p className="mt-2 text-sm leading-5" style={{ color: "GrayText" }}>
                  {formatEventDateTime(startsIso)}
                  {endsLabel ? ` to ${endsLabel}` : ""}
                </p>
              </div>

              {!countdown.started ? (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Days", value: countdown.days },
                    { label: "Hours", value: countdown.hours },
                    { label: "Mins", value: countdown.minutes },
                  ].map((part) => (
                    <div
                      key={part.label}
                      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-3 text-center"
                    >
                      <p className="text-lg font-bold tabular-nums" style={{ color: "CanvasText" }}>
                        {String(part.value).padStart(2, "0")}
                      </p>
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "GrayText" }}
                      >
                        {part.label}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm font-semibold"
                  style={{ color: "CanvasText" }}
                >
                  This event has started or passed
                </p>
              )}

              <div className="flex flex-wrap gap-3 text-sm" style={{ color: "GrayText" }}>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {formatEventDateTime(startsIso)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {joinUrl.trim() && !location.trim() ? (
                    <Video className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  )}
                  {displayLocation}
                </span>
              </div>

              <div>
                <h5
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "GrayText" }}
                >
                  About
                </h5>
                <p className="mt-2 text-sm leading-5" style={{ color: "CanvasText" }}>
                  {displayDescription}
                </p>
              </div>

              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--admin-primary)] px-4 py-2.5 text-sm font-bold text-[var(--admin-on-primary)]"
              >
                Register
                {registrationCount > 0 ? (
                  <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--admin-on-primary)_20%,transparent)] px-2 py-0.5 text-[11px] tabular-nums">
                    {formatEventCount(registrationCount)} registered
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventsBuilderPanel({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("details");
  const [event, setEvent] = useState<MarketingEventDto | null>(null);
  const [registrations, setRegistrations] = useState<MarketingEventRegistrationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("");

  const [regQuery, setRegQuery] = useState("");
  const [regPage, setRegPage] = useState(1);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const live = event?.status === "LIVE";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: MarketingEventDto }>(
        `/api/v1/marketing/events/${eventId}`,
      );
      const data = response.data;
      setEvent(data);
      setTitle(data.title);
      setDescription(data.description ?? "");
      setStartsAt(toLocalInputValue(data.startsAt));
      setEndsAt(toLocalInputValue(data.endsAt));
      setLocation(data.location ?? "");
      setJoinUrl(data.joinUrl ?? "");
      setCoverImageUrl(data.coverImageUrl ?? "");
      setReminderMinutes(
        data.reminderMinutesBefore == null ? "" : String(data.reminderMinutesBefore),
      );
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load event.");
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadRegistrations = useCallback(async () => {
    try {
      const response = await clientApi.get<{ data: { items: MarketingEventRegistrationDto[] } }>(
        `/api/v1/marketing/events/${eventId}/registrations`,
      );
      setRegistrations(response.data.items);
    } catch {
      setRegistrations([]);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "registrations") void loadRegistrations();
  }, [tab, loadRegistrations]);

  useEffect(() => {
    setRegPage(1);
  }, [regQuery]);

  const filteredRegistrations = useMemo(() => {
    const term = regQuery.trim().toLowerCase();
    if (!term) return registrations;
    return registrations.filter((row) => {
      const haystack = [row.email, row.name ?? "", registrationSourceLabel(row.source)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [registrations, regQuery]);

  const regTotalPages = Math.max(1, Math.ceil(filteredRegistrations.length / REG_PAGE_SIZE));
  const regSafePage = Math.min(regPage, regTotalPages);
  const regPageItems = useMemo(() => {
    const start = (regSafePage - 1) * REG_PAGE_SIZE;
    return filteredRegistrations.slice(start, start + REG_PAGE_SIZE);
  }, [filteredRegistrations, regSafePage]);

  const regRangeStart =
    filteredRegistrations.length === 0 ? 0 : (regSafePage - 1) * REG_PAGE_SIZE + 1;
  const regRangeEnd = Math.min(regSafePage * REG_PAGE_SIZE, filteredRegistrations.length);

  async function saveDetails() {
    const startsIso = fromLocalInputValue(startsAt);
    if (!title.trim() || !startsIso) {
      toast.error("Title and start time are required.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.patch<{ data: MarketingEventDto }>(
        `/api/v1/marketing/events/${eventId}`,
        {
          title: title.trim(),
          description: description.trim() || null,
          startsAt: startsIso,
          endsAt: fromLocalInputValue(endsAt),
          location: location.trim() || null,
          joinUrl: joinUrl.trim() || null,
          coverImageUrl: coverImageUrl.trim() || null,
          reminderMinutesBefore: reminderMinutes.trim() ? Number(reminderMinutes) : null,
        },
        "marketing-event-update",
        { successMessage: "Event saved." },
      );
      setEvent(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: MarketingEventDto }>(
        `/api/v1/marketing/events/${eventId}/publish`,
        {},
        "marketing-event-publish",
        { successMessage: "Event is Live." },
      );
      setEvent(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: MarketingEventDto }>(
        `/api/v1/marketing/events/${eventId}/unpublish`,
        {},
        "marketing-event-unpublish",
        { successMessage: "Event unpublished." },
      );
      setEvent(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Unpublish failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!event) return;
    if (deleteConfirm.trim() !== event.title.trim()) {
      toast.error("Type the event title to confirm delete.");
      return;
    }
    setBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/events/${eventId}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "marketing-event-delete",
        { successMessage: "Event deleted." },
      );
      router.push(EVENTS_LIST_HREF);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyJoinUrl() {
    if (!joinUrl.trim()) {
      toast.error("Add a join URL first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(joinUrl.trim());
      toast.success("Join URL copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  }

  function exportCsv() {
    if (!event || filteredRegistrations.length === 0) {
      toast.error("No registrations to export.");
      return;
    }
    const headers = ["Name", "Email", "Source", "Registered at"];
    const lines = [
      headers.map(csvEscape).join(","),
      ...filteredRegistrations.map((row) =>
        [row.name ?? "", row.email, registrationSourceLabel(row.source), row.createdAt]
          .map(csvEscape)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${event.title.replaceAll(/[^\w.-]+/g, "-").toLowerCase() || "event"}-registrations.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded.");
  }

  if (loading) {
    return <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading event...</p>;
  }
  if (!event) {
    return (
      <div className="space-y-4">
        <Link
          href={EVENTS_LIST_HREF}
          prefetch={false}
          className="text-sm font-semibold text-[var(--admin-primary)]"
        >
          Back to events
        </Link>
        <p className="text-sm text-[var(--admin-danger)]">Event not found.</p>
      </div>
    );
  }

  const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: "details", label: "Details" },
    { id: "registrations", label: `Registrations (${formatEventCount(event.registrationCount)})` },
    { id: "publish", label: "Publish" },
  ];

  const deleteMatches = deleteConfirm.trim() === event.title.trim();

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
      >
        <Link
          href={MARKETING_HREF}
          prefetch={false}
          className="transition-colors hover:text-[var(--admin-primary)]"
        >
          Marketing
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href={EVENTS_LIST_HREF}
          prefetch={false}
          className="transition-colors hover:text-[var(--admin-primary)]"
        >
          Events
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-primary)]">{event.title}</span>
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
              {event.title}
            </h1>
            <StatusChip status={event.status} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[13px] text-[var(--admin-on-surface-variant)]">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden="true" />
              {formatEventCount(event.registrationCount)} registrations
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Starts {formatEventDateTime(event.startsAt)}
            </span>
          </div>
          {live ? (
            <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
              This event is Live. Unpublish to edit details.
            </p>
          ) : (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Draft mode: edit details, review registrations, then publish when ready.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                void unpublish();
              }}
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                void publish();
              }}
            >
              Publish
            </button>
          )}
        </div>
      </header>

      <div role="tablist" className="flex flex-wrap gap-4 border-b border-[var(--admin-border)]">
        {tabs.map((entry) => {
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
                "relative -mb-px pb-3 text-xs font-bold tracking-[0.08em]",
                active ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface-variant)]",
              ].join(" ")}
            >
              {entry.label}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--admin-primary)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "details" ? (
        <div className="space-y-4">
          {live ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                Unpublish to edit event details.
              </p>
              <button
                type="button"
                className="inline-flex shrink-0 items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  void unpublish();
                }}
              >
                Unpublish
              </button>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <div>
                <label htmlFor="event-title" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Title
                </label>
                <input
                  id="event-title"
                  value={title}
                  disabled={live}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor="event-description" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Description
                </label>
                <textarea
                  id="event-description"
                  value={description}
                  disabled={live}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-24`}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="event-starts" className={MESSENGER_WIZARD_LABEL_CLASS}>
                    Starts at
                  </label>
                  <input
                    id="event-starts"
                    type="datetime-local"
                    value={startsAt}
                    disabled={live}
                    onChange={(event) => {
                      setStartsAt(event.target.value);
                    }}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="event-ends" className={MESSENGER_WIZARD_LABEL_CLASS}>
                    Ends at
                  </label>
                  <input
                    id="event-ends"
                    type="datetime-local"
                    value={endsAt}
                    disabled={live}
                    onChange={(event) => {
                      setEndsAt(event.target.value);
                    }}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="event-location" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Location
                </label>
                <input
                  id="event-location"
                  value={location}
                  disabled={live}
                  onChange={(event) => {
                    setLocation(event.target.value);
                  }}
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                  placeholder="Venue or Online"
                />
              </div>
              <div>
                <label htmlFor="event-reminder" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Reminder
                </label>
                <AdminSelectDropdown
                  id="event-reminder"
                  label={null}
                  ariaLabel="Reminder before event"
                  value={reminderMinutes}
                  options={[...REMINDER_OPTIONS]}
                  disabled={live}
                  onChange={(value) => {
                    setReminderMinutes(value);
                  }}
                />
              </div>
              <div>
                <label htmlFor="event-join-url" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Join URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="event-join-url"
                    value={joinUrl}
                    disabled={live}
                    onChange={(event) => {
                      setJoinUrl(event.target.value);
                    }}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                    placeholder="Meeting or webinar link"
                  />
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
                    disabled={!joinUrl.trim()}
                    aria-label="Copy join URL"
                    onClick={() => {
                      void copyJoinUrl();
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="event-cover-url" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Cover image URL
                </label>
                <input
                  id="event-cover-url"
                  value={coverImageUrl}
                  disabled={live}
                  onChange={(event) => {
                    setCoverImageUrl(event.target.value);
                  }}
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                  placeholder="https://"
                />
                {coverImageUrl.trim() ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-[var(--admin-border)]">
                    <img
                      src={coverImageUrl.trim()}
                      alt="Cover preview"
                      className="aspect-video w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || live}
                onClick={() => {
                  void saveDetails();
                }}
              >
                Save details
              </button>
            </div>

            <EventPublicPreview
              title={title}
              description={description}
              startsAt={startsAt}
              endsAt={endsAt}
              location={location}
              joinUrl={joinUrl}
              coverImageUrl={coverImageUrl}
              registrationCount={event.registrationCount}
            />
          </div>
        </div>
      ) : null}

      {tab === "registrations" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={regQuery}
                onChange={(event) => {
                  setRegQuery(event.target.value);
                }}
                placeholder="Search registrations..."
                className={`${MESSENGER_WIZARD_FIELD_CLASS} pl-9`}
                aria-label="Search registrations"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
              disabled={filteredRegistrations.length === 0}
              onClick={exportCsv}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </button>
          </div>

          {filteredRegistrations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--admin-border)] px-6 py-12 text-center">
              <Users
                className="mx-auto mb-3 h-8 w-8 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <p className="font-semibold text-[var(--admin-on-surface)]">No registrations yet</p>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Use a workflow Register for Marketing Event action or connect a form to collect
                sign-ups.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[var(--admin-surface-low)]">
                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Name
                      </th>
                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Email
                      </th>
                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Source
                      </th>
                      <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Registered
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {regPageItems.map((row) => (
                      <tr key={row.id} className="hover:bg-[var(--admin-surface-low)]">
                        <td className="px-6 py-4 text-[13px] text-[var(--admin-on-surface)]">
                          {row.name?.trim() || "-"}
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[var(--admin-on-surface)]">
                          {row.email}
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[var(--admin-on-surface-variant)]">
                          {registrationSourceLabel(row.source)}
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[var(--admin-on-surface-variant)]">
                          <time dateTime={row.createdAt} title={row.createdAt}>
                            {formatEventDateTime(row.createdAt)}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRegistrations.length > REG_PAGE_SIZE ? (
                <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
                  <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                    Showing {String(regRangeStart)} to {String(regRangeEnd)} of{" "}
                    {String(filteredRegistrations.length)} registrations
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={regSafePage <= 1}
                      onClick={() => {
                        setRegPage((current) => Math.max(1, current - 1));
                      }}
                      className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>
                    <span className="min-w-[4.5rem] text-center text-[12px] font-bold text-[var(--admin-on-surface)]">
                      {String(regSafePage)} / {String(regTotalPages)}
                    </span>
                    <button
                      type="button"
                      disabled={regSafePage >= regTotalPages}
                      onClick={() => {
                        setRegPage((current) => Math.min(regTotalPages, current + 1));
                      }}
                      className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {tab === "publish" ? (
        <div className="max-w-xl space-y-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-on-surface)]">
              Publication status
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-on-surface-variant)]">
              Status:{" "}
              <strong className="text-[var(--admin-on-surface)]">
                {eventStatusLabel(event.status)}
              </strong>
              . Live events appear on your public events API for upcoming listings and accept new
              registrations. Unpublish before editing details or deleting.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {live ? (
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  void unpublish();
                }}
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  void publish();
                }}
              >
                Publish
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-danger)] transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={busy || live}
              onClick={() => {
                setDeleteOpen(true);
                setDeleteConfirm("");
              }}
            >
              Delete event
            </button>
          </div>

          <p className="text-[12px] leading-5 text-[var(--admin-on-surface-variant)]">
            Workflow action ID for registrations:{" "}
            <code className="rounded bg-[var(--admin-surface-low)] px-1.5 py-0.5 font-mono text-[11px]">
              {event.id}
            </code>
          </p>
        </div>
      ) : null}

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="presentation"
          onClick={() => {
            if (!busy) {
              setDeleteOpen(false);
              setDeleteConfirm("");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-builder-delete-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2
              id="event-builder-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete event
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Unpublish first if Live. Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{event.title}</span> to
              confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              aria-label="Confirm event title"
              disabled={busy}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)]"
                disabled={busy}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || !deleteMatches}
                onClick={() => {
                  void onDelete();
                }}
              >
                {busy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
