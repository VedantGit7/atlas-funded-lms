"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Info, ListChecks, Users, Workflow } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  EVENTS_LIST_HREF,
  MARKETING_HREF,
  eventHref,
  fromLocalInputValue,
  type MarketingEventDto,
} from "./events-shared";

export function EventsCreatePanel() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    const startsIso = fromLocalInputValue(startsAt);
    if (!startsIso) {
      toast.error("Start date and time are required.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: MarketingEventDto }>(
        "/api/v1/marketing/events",
        {
          title: title.trim(),
          description: description.trim() || null,
          startsAt: startsIso,
          endsAt: fromLocalInputValue(endsAt),
        },
        "marketing-event-create",
        { successMessage: "Event created." },
      );
      router.push(eventHref(response.data.id));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not create event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto max-w-[600px] space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div>
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
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
          <span className="text-[var(--admin-primary)]">Create</span>
        </nav>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
          Create event
        </h1>
        <p className="mt-1 max-w-xl text-[15px] leading-6 text-[var(--admin-on-surface-variant)]">
          Set the title and schedule. You will configure location, join link, cover image, and
          registrations in the builder.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:p-6">
        <div>
          <label htmlFor="event-create-title" className={MESSENGER_WIZARD_LABEL_CLASS}>
            Title
          </label>
          <input
            id="event-create-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className={MESSENGER_WIZARD_FIELD_CLASS}
            maxLength={200}
            placeholder="Academy workshop"
          />
        </div>
        <div>
          <label htmlFor="event-create-description" className={MESSENGER_WIZARD_LABEL_CLASS}>
            Description{" "}
            <span className="font-normal text-[var(--admin-on-surface-variant)]">(optional)</span>
          </label>
          <textarea
            id="event-create-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-24`}
            maxLength={2000}
            placeholder="What learners can expect..."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="event-create-starts" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Starts at
            </label>
            <input
              id="event-create-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => {
                setStartsAt(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              required
            />
          </div>
          <div>
            <label htmlFor="event-create-ends" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Ends at{" "}
              <span className="font-normal text-[var(--admin-on-surface-variant)]">(optional)</span>
            </label>
            <input
              id="event-create-ends"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => {
                setEndsAt(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">What&apos;s next</h2>
          </div>
          <p className="text-[13px] leading-5 text-[var(--admin-on-surface-variant)]">
            After creating the event, you will configure location, join link, cover image, reminder
            timing, and review registrations before publishing.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <ListChecks className="mb-2 h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
          <p className="text-sm font-bold text-[var(--admin-on-surface)]">Setup details</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--admin-on-surface-variant)]">
            Add venue or online join info and a cover image on the Details tab.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <Workflow className="mb-2 h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
          <p className="text-sm font-bold text-[var(--admin-on-surface)]">
            Invite via workflows/forms
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--admin-on-surface-variant)]">
            Connect a form or workflow action to register contacts for this event.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <Users className="mb-2 h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
          <p className="text-sm font-bold text-[var(--admin-on-surface)]">Track registrations</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--admin-on-surface-variant)]">
            View name, email, and source for every registration in the builder.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            void onCreate();
          }}
        >
          {busy ? "Creating..." : "Create & continue"}
        </button>
        <Link
          href={EVENTS_LIST_HREF}
          prefetch={false}
          className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
        >
          Discard
        </Link>
      </div>
    </div>
  );
}
