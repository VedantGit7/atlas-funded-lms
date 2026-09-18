"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";

type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  linkUrl: string | null;
  joinUrl: string | null;
  coverImageUrl: string | null;
};

type RegisterResult = { registered: true; eventId: string; alreadyRegistered: boolean };

function formatRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const startLabel = start.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
  if (endsAt === null) return startLabel;
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  return `${startLabel} — ${end.toLocaleString(
    undefined,
    sameDay ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" },
  )}`;
}

/**
 * Public event page and registration.
 *
 * The learner dashboard already counted down to these events, but the detail
 * and registration endpoints had no caller at all — so an event could be
 * created and promoted with no page for anyone to land on, and the registration
 * route accepted nothing. Both are public and unauthenticated by design: the
 * point of a marketing event is that people who do not yet have an account can
 * sign up for it.
 */
export function PublicEventPage({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/v1/public/marketing/events/${encodeURIComponent(eventId)}`,
        { method: "GET", credentials: "include" },
      );
      if (!response.ok) throw new Error(String(response.status));
      const json = (await response.json()) as { data: PublicEvent };
      setEvent(json.data);
    } catch {
      setLoadError("This event is not available.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRegister(submitEvent: React.SyntheticEvent) {
    submitEvent.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch(
        `/api/v1/public/marketing/events/${encodeURIComponent(eventId)}/register`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            // The schema accepts null for "not given"; an empty string is not a name.
            name: name.trim() === "" ? null : name.trim(),
            source: "LINK",
          }),
        },
      );
      if (!response.ok) throw new Error(String(response.status));
      const json = (await response.json()) as { data: RegisterResult };
      setResult(json.data);
    } catch {
      setFormError("Registration failed. Check the address and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-[var(--muted-foreground)]">Loading event…</p>;
  }

  if (loadError !== null || event === null) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-foreground">Event unavailable</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {loadError ?? "This event is not available."}
        </p>
        <Link href="/p/home" className="mt-6 inline-block text-sm font-semibold text-primary">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {event.coverImageUrl === null ? null : (
        // Intentionally a plain <img>: the URL is tenant-supplied and arbitrary
        // hosts are not in the next/image allowlist, which throws at render.
        <img
          src={event.coverImageUrl}
          alt=""
          className="mb-8 max-h-72 w-full rounded-2xl object-cover"
        />
      )}

      <h1 className="text-3xl font-semibold text-foreground">{event.title}</h1>

      <dl className="mt-4 space-y-2 text-sm text-[var(--muted-foreground)]">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">When</dt>
          <dd>{formatRange(event.startsAt, event.endsAt)}</dd>
        </div>
        {event.location === null ? null : (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Where</dt>
            <dd>{event.location}</dd>
          </div>
        )}
      </dl>

      {event.description === null ? null : (
        <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-foreground">
          {event.description}
        </p>
      )}

      <section className="mt-10 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Register</h2>

        {result === null ? (
          <>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              We will email you the joining details.
            </p>
            <form className="mt-4 space-y-3" onSubmit={(e) => void handleRegister(e)}>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">Name (optional)</span>
                <input
                  autoComplete="name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                />
              </label>

              {formError === null ? null : (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Registering…" : "Register"}
              </button>
            </form>
          </>
        ) : (
          <div className="mt-2">
            <p className="text-sm font-medium text-foreground">
              {result.alreadyRegistered
                ? "You were already registered for this event."
                : "You are registered. Check your email for the details."}
            </p>
            {event.joinUrl === null ? null : (
              <a
                href={event.joinUrl}
                className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                rel="noreferrer noopener"
                target="_blank"
              >
                Join the event
              </a>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
