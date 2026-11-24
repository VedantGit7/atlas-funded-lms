"use client";

import { SafeHtml } from "@/components/SafeHtml";
import { useEffect, useState, type SyntheticEvent } from "react";
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
  signupEmailSent: boolean;
};

type Answer = string | string[] | boolean;

const INPUT_CLASS =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

function initialAnswer(field: FormField): Answer {
  if (field.fieldType === "checkboxes") return [];
  if (field.fieldType === "consent") return false;
  return "";
}

function inputType(field: FormField): string {
  switch (field.fieldType) {
    case "email":
      return "email";
    case "number":
      return "number";
    case "phone":
      return "tel";
    case "date":
      return "date";
    default:
      return "text";
  }
}

function autoComplete(field: FormField): string | undefined {
  if (field.fieldType === "email") return "email";
  if (field.fieldType === "phone") return "tel";
  if (field.key === "name" || field.key === "full_name") return "name";
  return undefined;
}

function RequiredMark({ required }: { required: boolean }) {
  return required ? (
    <span className="text-destructive-text" aria-hidden="true">
      {" "}
      *
    </span>
  ) : null;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: Answer;
  onChange: (value: Answer) => void;
}) {
  const options = field.options ?? [];

  if (field.fieldType === "consent") {
    return (
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          id={field.key}
          type="checkbox"
          required={field.required}
          checked={value === true}
          aria-labelledby={`${field.key}-label`}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span id={`${field.key}-label`}>
          {field.label}
          <RequiredMark required={field.required} />
        </span>
      </label>
    );
  }

  if (field.fieldType === "radio" || field.fieldType === "checkboxes") {
    const multiple = field.fieldType === "checkboxes";
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-foreground">
          {field.label}
          <RequiredMark required={field.required} />
        </legend>
        <div className="space-y-2">
          {options.map((option, index) => (
            <label
              key={option}
              className="flex items-center gap-3 text-sm text-foreground"
              htmlFor={`${field.key}-${String(index)}`}
            >
              <input
                id={`${field.key}-${String(index)}`}
                type={multiple ? "checkbox" : "radio"}
                name={field.key}
                value={option}
                // A required radio group needs one choice; checkboxes are
                // checked on submit, since the browser can't require "any one".
                required={!multiple && field.required}
                checked={multiple ? selected.includes(option) : value === option}
                onChange={(e) => {
                  if (!multiple) {
                    onChange(option);
                    return;
                  }
                  onChange(
                    e.target.checked
                      ? [...selected, option]
                      : selected.filter((entry) => entry !== option),
                  );
                }}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const label = (
    <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor={field.key}>
      {field.label}
      <RequiredMark required={field.required} />
    </label>
  );
  const text = typeof value === "string" ? value : "";

  if (field.fieldType === "select") {
    return (
      <div>
        {label}
        <select
          id={field.key}
          required={field.required}
          value={text}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className={INPUT_CLASS}
        >
          <option value="">{field.placeholder || "Choose one"}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.fieldType === "textarea") {
    return (
      <div>
        {label}
        <textarea
          id={field.key}
          required={field.required}
          placeholder={field.placeholder ?? undefined}
          value={text}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className={`${INPUT_CLASS} min-h-24`}
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        id={field.key}
        type={inputType(field)}
        required={field.required}
        autoComplete={autoComplete(field)}
        placeholder={field.placeholder ?? undefined}
        value={text}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={INPUT_CLASS}
      />
    </div>
  );
}

/**
 * The public form at /f/…, shown inside the academy's own site header
 * (QA review 1 m12: the page had no logo or branding).
 */
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
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
          throw new Error(json.error?.message ?? "This form isn't available.");
        }
        if (!cancelled && json.data) {
          setForm(json.data);
          const initial: Record<string, Answer> = {};
          for (const field of json.data.fields) initial[field.key] = initialAnswer(field);
          setAnswers(initial);
        }
      } catch (caught) {
        if (!cancelled)
          setError(caught instanceof Error ? caught.message : "This form isn't available.");
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
    const missingChoice = form.fields.find(
      (field) =>
        field.fieldType === "checkboxes" &&
        field.required &&
        !(Array.isArray(answers[field.key]) && (answers[field.key] as string[]).length > 0),
    );
    if (missingChoice) {
      setSubmitError(`Choose at least one option for ${missingChoice.label}.`);
      return;
    }
    setBusy(true);
    setSubmitError(null);
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
      if (!response.ok || !json.data) {
        throw new Error(json.error?.message ?? "Your answers weren't sent. Try again.");
      }
      setDone(json.data);
      if (json.data.redirectUrl) {
        window.location.assign(json.data.redirectUrl);
      }
    } catch (caught) {
      setSubmitError(
        caught instanceof Error ? caught.message : "Your answers weren't sent. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="mx-auto max-w-lg px-6 py-16 text-sm text-muted-foreground">Loading form…</p>
    );
  }
  if (error || !form) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold text-foreground">Form unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "This form isn't available."}
        </p>
      </div>
    );
  }

  const card = "rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8";

  if (done && !done.redirectUrl) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <div className={`${card} space-y-4`} role="status">
          <h1 className="text-2xl font-semibold text-foreground">{form.title}</h1>
          {done.signupEmailSent ? (
            <p className="text-foreground">
              Check your email for the link to finish creating your account. You&rsquo;ll choose
              your password there.
            </p>
          ) : null}
          {done.thankYouHtml ? (
            <SafeHtml html={done.thankYouHtml} variant="inline" />
          ) : done.signupEmailSent ? null : (
            <p className="text-foreground">Thanks, your answers were sent.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className={`${card} space-y-6`}>
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{form.title}</h1>
          {form.description ? <p className="text-muted-foreground">{form.description}</p> : null}
        </header>
        {form.kind === "SIGNUP" && form.googleSignupEnabled ? (
          <div className="space-y-3">
            <a
              href={`/auth/oauth/google?remember=0&next=${encodeURIComponent("/")}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
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
            <div className="relative py-1 text-center text-xs text-muted-foreground">
              <span className="relative z-[1] bg-card px-2">or</span>
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
            </div>
          </div>
        ) : null}
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
          {form.fields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              value={answers[field.key] ?? initialAnswer(field)}
              onChange={(value) => {
                setAnswers((prev) => ({ ...prev, [field.key]: value }));
              }}
            />
          ))}
          {submitError ? (
            <p role="alert" className="text-sm font-medium text-destructive-text">
              {submitError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-60"
            style={{ backgroundColor: form.buttonColor, color: form.buttonTextColor }}
          >
            {busy ? "Sending…" : form.buttonText}
          </button>
        </form>
      </div>
    </div>
  );
}
