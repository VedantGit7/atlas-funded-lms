"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import {
  SUB_SCHOOLS_HREF,
  SUB_SCHOOL_URL_SUFFIX,
  slugifySubSchoolUrl,
  subSchoolDetailHref,
} from "./sub-schools-shared";

const NAME_MAX = 60;

const fieldClassName =
  "w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3.5 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:opacity-60";

const labelClassName = "text-sm font-semibold text-[var(--admin-on-surface)]";

const errorTextClassName = "mt-1.5 text-xs font-medium text-[var(--admin-danger)]";

type FieldErrors = {
  name?: string;
  url?: string;
  mobileNumber?: string;
  email?: string;
  password?: string;
};

function validate(values: {
  name: string;
  url: string;
  mobileNumber: string;
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Sub-school name is required.";
  else if (values.name.trim().length > NAME_MAX)
    errors.name = `Name must be ${NAME_MAX} characters or fewer.`;

  if (!values.url.trim()) errors.url = "URL is required.";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.url)) {
    errors.url = "Use lowercase letters, numbers, and hyphens only.";
  }

  if (!values.mobileNumber.trim()) errors.mobileNumber = "Mobile number is required.";
  else if (!/^[+]?[\d\s()-]{7,20}$/.test(values.mobileNumber.trim())) {
    errors.mobileNumber = "Enter a valid mobile number.";
  }

  if (!values.email.trim()) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) errors.password = "Password is required.";
  else if (values.password.length < 8) errors.password = "Password must be at least 8 characters.";

  return errors;
}

export function CreateSubSchoolPanel() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [urlTouched, setUrlTouched] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const passwordHint = useMemo(() => {
    if (!password) return "Use at least 8 characters.";
    if (password.length < 8) return `${8 - password.length} more characters needed.`;
    return "Looks good.";
  }, [password]);

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    const nextUrl = urlTouched ? url : slugifySubSchoolUrl(name);
    const values = {
      name: name.trim(),
      url: nextUrl,
      mobileNumber: mobileNumber.trim(),
      email: email.trim(),
      password,
    };
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Fix the highlighted fields and try again.");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const created = await clientApi.post<{ data: { id: string; name: string } }>(
        "/api/v1/sub-schools",
        {
          name: values.name,
          key: values.url,
          mobileNumber: values.mobileNumber,
          email: values.email,
          password: values.password,
        },
        `sub-school-create-${values.url}`,
        { successMessage: `${values.name} created.` },
      );
      router.push(subSchoolDetailHref(created.data.id));
      router.refresh();
    } catch (caught) {
      setFormError(
        caught instanceof ClientApiError ? caught.message : "Could not create the sub-school.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <Link href={SUB_SCHOOLS_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Link>

      <header className="space-y-1.5">
        <p className="text-sm font-semibold text-[var(--admin-success)]">Create Sub-School</p>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
          Create Sub-School
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Start creating a new Sub-School
        </p>
      </header>

      <form
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm sm:p-7"
      >
        <div className="space-y-5">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="sub-school-name" className={labelClassName}>
                Sub-School Name<span className="text-[var(--admin-danger)]">*</span>
              </label>
              <span
                className={[
                  "text-xs tabular-nums",
                  name.length >= NAME_MAX
                    ? "font-semibold text-[var(--admin-danger)]"
                    : "text-[var(--admin-on-surface-variant)]",
                ].join(" ")}
                aria-live="polite"
              >
                {name.length}/{NAME_MAX}
              </span>
            </div>
            <input
              id="sub-school-name"
              type="text"
              value={name}
              maxLength={NAME_MAX}
              disabled={busy}
              autoComplete="organization"
              placeholder="Enter sub-school name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "sub-school-name-error" : undefined}
              onChange={(event) => {
                const next = event.target.value.slice(0, NAME_MAX);
                setName(next);
                if (!urlTouched) setUrl(slugifySubSchoolUrl(next));
              }}
              className={fieldClassName}
            />
            {fieldErrors.name ? (
              <p id="sub-school-name-error" className={errorTextClassName}>
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="sub-school-url" className={`${labelClassName} mb-1.5 block`}>
              URL<span className="text-[var(--admin-danger)]">*</span>
            </label>
            <div className="flex overflow-hidden rounded-lg border border-[var(--admin-outline)] focus-within:border-[var(--admin-primary)] focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/30">
              <input
                id="sub-school-url"
                type="text"
                value={url}
                maxLength={64}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                placeholder="Enter URL"
                aria-invalid={Boolean(fieldErrors.url)}
                aria-describedby="sub-school-url-help"
                onChange={(event) => {
                  setUrlTouched(true);
                  setUrl(slugifySubSchoolUrl(event.target.value));
                }}
                className="min-w-0 flex-1 border-0 bg-[var(--admin-surface)] px-3.5 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] disabled:opacity-60"
              />
              <span className="inline-flex shrink-0 items-center border-l border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-3 text-sm text-[var(--admin-on-surface-variant)]">
                {SUB_SCHOOL_URL_SUFFIX}
              </span>
            </div>
            <p
              id="sub-school-url-help"
              className="mt-1.5 text-xs text-[var(--admin-on-surface-variant)]"
            >
              Learners will open{" "}
              <span className="font-medium text-[var(--admin-on-surface)]">
                {url || "your-slug"}
                {SUB_SCHOOL_URL_SUFFIX}
              </span>
            </p>
            {fieldErrors.url ? <p className={errorTextClassName}>{fieldErrors.url}</p> : null}
          </div>

          <div>
            <label htmlFor="sub-school-mobile" className={`${labelClassName} mb-1.5 block`}>
              Mobile Number<span className="text-[var(--admin-danger)]">*</span>
            </label>
            <input
              id="sub-school-mobile"
              type="tel"
              value={mobileNumber}
              maxLength={20}
              disabled={busy}
              autoComplete="tel"
              placeholder="Enter mobile number"
              aria-invalid={Boolean(fieldErrors.mobileNumber)}
              onChange={(event) => {
                setMobileNumber(event.target.value);
              }}
              className={fieldClassName}
            />
            {fieldErrors.mobileNumber ? (
              <p className={errorTextClassName}>{fieldErrors.mobileNumber}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="sub-school-email" className={`${labelClassName} mb-1.5 block`}>
              Sub-School Email Id<span className="text-[var(--admin-danger)]">*</span>
            </label>
            <input
              id="sub-school-email"
              type="email"
              value={email}
              maxLength={320}
              disabled={busy}
              autoComplete="email"
              placeholder="Enter email id"
              aria-invalid={Boolean(fieldErrors.email)}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              className={fieldClassName}
            />
            {fieldErrors.email ? <p className={errorTextClassName}>{fieldErrors.email}</p> : null}
          </div>

          <div>
            <label htmlFor="sub-school-password" className={`${labelClassName} mb-1.5 block`}>
              Sub-School Password<span className="text-[var(--admin-danger)]">*</span>
            </label>
            <div className="relative">
              <input
                id="sub-school-password"
                type={showPassword ? "text" : "password"}
                value={password}
                maxLength={128}
                disabled={busy}
                autoComplete="new-password"
                placeholder="Enter the password"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby="sub-school-password-hint"
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                className={`${fieldClassName} pr-11`}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowPassword((value) => !value);
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <p
              id="sub-school-password-hint"
              className={[
                "mt-1.5 text-xs",
                password.length >= 8
                  ? "text-[var(--admin-success)]"
                  : "text-[var(--admin-on-surface-variant)]",
              ].join(" ")}
            >
              {passwordHint}
            </p>
            {fieldErrors.password ? (
              <p className={errorTextClassName}>{fieldErrors.password}</p>
            ) : null}
          </div>

          {formError ? (
            <p
              role="alert"
              className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-3 py-2 text-sm text-[var(--admin-danger)]"
            >
              {formError}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--admin-on-surface)] px-5 py-2.5 text-sm font-bold text-[var(--admin-surface)] shadow-sm transition-all hover:opacity-90 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Create
          </button>
          <Link
            href={SUB_SCHOOLS_HREF}
            prefetch={false}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-variant)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
