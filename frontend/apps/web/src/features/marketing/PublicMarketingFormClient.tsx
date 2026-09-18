"use client";

import { SafeHtml } from "@/components/SafeHtml";
import { useEffect, useState, type SyntheticEvent } from "react";
import { toast } from "@/lib/client-api";
import type { FormField, FormKind } from "@/features/admin/grow/forms-shared";

type PublicForm = {
  title: string;
  description: string | null;
  kind: FormKind;
  googleSignupEnabled: boolean;
  buttonText: string;
  buttonColor: string;
  buttonTextColor: string;
  fields: FormField[];
};

type SubmitResult = {
  submitted: true;
  thankYouHtml: string | null;
  redirectUrl: string | null;
};

export function PublicMarketingFormClient({
  token,
  source = "LINK",
}: {
  token: string;
  source?: "LINK" | "WEBSITE" | "CTA";
}) {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<SubmitResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/public/marketing/forms/${encodeURIComponent(token)}`,
          {
            method: "GET",
            credentials: "include",
          },
        );
        const json = (await response.json()) as { data?: PublicForm; error?: { message?: string } };
        if (!response.ok) {
          throw new Error(json.error?.message ?? "Form not available.");
        }
        if (!cancelled && json.data) {
          setForm(json.data);
          const initial: Record<string, string> = {};
          for (const field of json.data.fields) initial[field.key] = "";
          setAnswers(initial);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Form not available.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/v1/public/marketing/forms/${encodeURIComponent(token)}/submit`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers, source }),
        },
      );
      const json = (await response.json()) as {
        data?: SubmitResult;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(json.error?.message ?? "Submit failed.");
      }
      if (!json.data) throw new Error("Submit failed.");
      setDone(json.data);
      if (json.data.redirectUrl) {
        window.location.assign(json.data.redirectUrl);
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-neutral-600">Loading form…</p>;
  }
  if (error || !form) {
    return <p className="p-8 text-sm text-red-600">{error ?? "Form not available."}</p>;
  }
  if (done && !done.redirectUrl) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <h1 className="text-2xl font-semibold">{form.title}</h1>
        {done.thankYouHtml ? (
          <SafeHtml html={done.thankYouHtml} variant="inline" />
        ) : (
          <p className="text-neutral-700">Thanks — your response was submitted.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{form.title}</h1>
        {form.description ? <p className="text-neutral-600">{form.description}</p> : null}
      </header>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {form.fields.map((field) => (
          <div key={field.id}>
            <label className="mb-1.5 block text-sm font-medium" htmlFor={field.key}>
              {field.label}
              {field.required ? " *" : ""}
            </label>
            {field.fieldType === "textarea" ? (
              <textarea
                id={field.key}
                required={field.required}
                placeholder={field.placeholder ?? undefined}
                value={answers[field.key] ?? ""}
                onChange={(e) => {
                  setAnswers((prev) => ({ ...prev, [field.key]: e.target.value }));
                }}
                className="min-h-24 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
              />
            ) : (
              <input
                id={field.key}
                type={
                  field.fieldType === "password"
                    ? "password"
                    : field.fieldType === "email"
                      ? "email"
                      : field.fieldType === "number"
                        ? "number"
                        : field.fieldType === "phone"
                          ? "tel"
                          : "text"
                }
                required={field.required}
                placeholder={field.placeholder ?? undefined}
                value={answers[field.key] ?? ""}
                onChange={(e) => {
                  setAnswers((prev) => ({ ...prev, [field.key]: e.target.value }));
                }}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
              />
            )}
          </div>
        ))}
        {form.kind === "SIGNUP" && form.googleSignupEnabled ? (
          <div className="space-y-3">
            <a
              href={`/auth/oauth/google?remember=0&next=${encodeURIComponent("/")}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                />
              </svg>
              Continue with Google
            </a>
            <div className="relative py-1 text-center text-xs text-neutral-400">
              <span className="relative z-[1] bg-white px-2">or</span>
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-neutral-200" />
            </div>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: form.buttonColor, color: form.buttonTextColor }}
        >
          {busy ? "Submitting…" : form.buttonText}
        </button>
      </form>
    </div>
  );
}
