"use client";

import { useEffect, useId, useState } from "react";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { SettingsSectionHeading, SettingTextField } from "../settings/settings-form-controls";

type Mode = "direct" | "queued";

type TestResult = {
  testId: string;
  mode: Mode;
  to: string;
  status: "queued" | "sent" | "failed";
  errorCode: string | null;
  message: string;
};

type MeResponse = { data: { identity: { email: string | null } } };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POLL_INTERVAL_MS = 2_000;
// The worker sweeps every few seconds; a minute without an answer means it is
// stopped or failing, which is worth saying instead of spinning forever.
const POLL_LIMIT = 30;

const MODES: ReadonlyArray<{ value: Mode; title: string; description: string }> = [
  {
    value: "direct",
    title: "Send now",
    description: "Hands one email to the mail server and shows its answer.",
  },
  {
    value: "queued",
    title: "Through the notification queue",
    description: "Sends it to you the way real notifications go, through the worker.",
  },
];

/**
 * "Send test email" for the Transactional Email channel (the only channel
 * notifications are sent through, hence the fixed routes). It uses the saved
 * sender, so it is disabled while the form above has unsaved changes.
 */
export function ChannelTestEmailSection({ unsavedChanges }: { unsavedChanges: boolean }) {
  const modeGroupId = useId();
  const [mode, setMode] = useState<Mode>("direct");
  const [to, setTo] = useState("");
  const [ownEmail, setOwnEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [polls, setPolls] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void clientApi
      .get<MeResponse>("/api/v1/me")
      .then((me) => {
        if (cancelled || !me.data.identity.email) return;
        setOwnEmail(me.data.identity.email);
        setTo((current) => current || (me.data.identity.email ?? ""));
      })
      .catch(() => {
        /* The address field stays empty; the admin types one. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const waiting = result?.mode === "queued" && result.status === "queued";
  const gaveUp = waiting && polls >= POLL_LIMIT;

  useEffect(() => {
    if (!waiting || gaveUp) return;
    const timer = setTimeout(() => {
      void clientApi
        .get<{ data: TestResult }>(
          `/api/v1/tenant-settings/transactional-email/test/${encodeURIComponent(result.testId)}`,
        )
        .then((response) => {
          setResult(response.data);
        })
        .catch(() => {
          /* A missed poll is retried on the next tick. */
        })
        .finally(() => {
          setPolls((count) => count + 1);
        });
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [gaveUp, polls, result, waiting]);

  const toError =
    mode === "direct" && to.trim() && !EMAIL_RE.test(to.trim())
      ? "Enter a valid email address."
      : null;
  const canSend =
    !sending && !unsavedChanges && !waiting && (mode === "queued" || EMAIL_RE.test(to.trim()));

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    setResult(null);
    setPolls(0);
    try {
      const response = await clientApi.post<{ data: TestResult }>(
        "/api/v1/tenant-settings/transactional-email/test",
        mode === "direct" ? { mode, to: to.trim() } : { mode },
        "channel-test-email",
        { silent: true },
      );
      setResult(response.data);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not send the test. Try again.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-10 space-y-5 border-t border-[var(--admin-border)] pt-8">
      <SettingsSectionHeading
        title="Send a test email"
        description="Check that email from this academy reaches an inbox, using the saved sender above."
      />

      <div
        role="radiogroup"
        aria-labelledby={`${modeGroupId}-label`}
        className="grid gap-3 sm:grid-cols-2"
      >
        <span id={`${modeGroupId}-label`} className="sr-only">
          How to send the test
        </span>
        {MODES.map((option) => {
          const selected = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={sending || waiting}
              onClick={() => {
                setMode(option.value);
              }}
              className={[
                "rounded-xl border p-4 text-left motion-safe:transition-colors motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-outline)]",
              ].join(" ")}
            >
              <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                {option.title}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      {mode === "direct" ? (
        <SettingTextField
          label="Send to"
          type="email"
          value={to}
          onChange={setTo}
          placeholder="name@example.com"
          disabled={sending}
          error={toError}
        />
      ) : (
        <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {ownEmail ? (
            <>
              Goes to your own address,{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{ownEmail}</span>.
            </>
          ) : (
            "Goes to your own address."
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void send()}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Send test email
        </button>
        {unsavedChanges ? (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Save your changes first. The test uses the saved sender.
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      {result ? <TestResultCard result={result} gaveUp={gaveUp} /> : null}
    </section>
  );
}

export function TestResultCard({ result, gaveUp }: { result: TestResult; gaveUp: boolean }) {
  const tone =
    result.status === "sent"
      ? "text-[var(--admin-success)]"
      : result.status === "failed"
        ? "text-[var(--admin-danger)]"
        : "text-[var(--admin-on-surface-variant)]";
  const heading =
    result.status === "sent"
      ? `Sent to ${result.to}`
      : result.status === "failed"
        ? `Not sent to ${result.to}`
        : `Queued for ${result.to}`;
  const message = gaveUp
    ? "No answer from the notification worker after a minute. It may be stopped; check its health, then try again."
    : result.message;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
    >
      <span className={`mt-0.5 shrink-0 ${tone}`}>
        {result.status === "sent" ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        ) : result.status === "failed" ? (
          <XCircle className="h-5 w-5" aria-hidden="true" />
        ) : gaveUp ? (
          <XCircle className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${tone}`}>{heading}</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {message}
        </p>
        {result.errorCode ? (
          <p className="mt-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
            {result.errorCode}
          </p>
        ) : null}
      </div>
    </div>
  );
}
