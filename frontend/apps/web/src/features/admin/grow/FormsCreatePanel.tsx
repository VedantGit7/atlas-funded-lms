"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Lock, Loader2, UserPlus, X } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import { FORMS_LIST_HREF, formHref, type FormDto, type FormKind } from "./forms-shared";

const LABEL_CLASS = `${MESSENGER_WIZARD_LABEL_CLASS} !mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]`;

export function FormsCreatePanel() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<FormKind>("LEAD");
  const [busy, setBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();

  async function onCreate() {
    if (!title.trim()) {
      setTitleError("Title is required.");
      toast.error("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: FormDto }>(
        "/api/v1/marketing/forms",
        { title: title.trim(), description: description.trim() || null, kind },
        "form-create",
        { successMessage: "Form created." },
      );
      router.push(formHref(response.data.id));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not create form.");
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-10rem)] max-w-[640px] flex-col justify-center px-2 py-8">
      <div
        className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link
          href={FORMS_LIST_HREF}
          prefetch={false}
          className="inline-flex items-center gap-1 font-semibold text-[var(--admin-on-surface)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Forms
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <span className="font-semibold text-[var(--admin-primary)]">Create</span>
      </div>

      <div className="relative rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Create a new form
          </h1>
          <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
            Give your form a name and choose the type to get started.
          </p>
        </div>

        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreate();
          }}
        >
          <div>
            <label htmlFor="form-create-title" className={LABEL_CLASS}>
              Form title
            </label>
            <input
              id="form-create-title"
              value={title}
              maxLength={200}
              placeholder="e.g. Q4 Newsletter Signup"
              disabled={busy}
              onChange={(event) => {
                setTitle(event.target.value);
                if (titleError) setTitleError(undefined);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              aria-invalid={Boolean(titleError)}
            />
            {titleError ? (
              <p className="mt-1.5 text-xs text-[var(--admin-danger)]">{titleError}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="form-create-description" className={LABEL_CLASS}>
              Description
            </label>
            <textarea
              id="form-create-description"
              value={description}
              maxLength={2000}
              rows={3}
              placeholder="What is this form for?"
              disabled={busy}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className={`${MESSENGER_WIZARD_FIELD_CLASS} resize-none`}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className={LABEL_CLASS}>Form type</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(
                [
                  {
                    id: "LEAD" as const,
                    title: "Lead capture form",
                    description: "Collect names and contact info to grow your audience.",
                    Icon: UserPlus,
                  },
                  {
                    id: "SIGNUP" as const,
                    title: "Sign-up form",
                    description:
                      "Includes system-locked email and password fields for learner account creation.",
                    Icon: Lock,
                  },
                ] as const
              ).map((option) => {
                const selected = kind === option.id;
                const Icon = option.Icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={selected}
                    onClick={() => {
                      setKind(option.id);
                    }}
                    className={[
                      "group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200",
                      selected
                        ? "border-[var(--admin-primary)] bg-[var(--admin-primary-container)] shadow-[0_0_0_1px_var(--admin-primary)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-bg)] hover:border-[var(--admin-outline)]",
                    ].join(" ")}
                  >
                    {selected ? (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--admin-primary)] text-[var(--admin-on-primary)]">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    ) : null}
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform motion-safe:group-hover:scale-110",
                          selected
                            ? "bg-[var(--admin-surface)] text-[var(--admin-primary)]"
                            : "bg-[var(--admin-surface-high)] text-[var(--admin-primary)]",
                        ].join(" ")}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={[
                            "text-[15px] font-semibold",
                            selected
                              ? "text-[var(--admin-on-primary-container)]"
                              : "text-[var(--admin-on-surface)]",
                          ].join(" ")}
                        >
                          {option.title}
                        </p>
                        <p
                          className={[
                            "mt-1 text-[13px]",
                            selected
                              ? "text-[var(--admin-on-primary-container)]/80"
                              : "text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-4 text-[15px] font-semibold text-[var(--admin-on-primary)] shadow-sm transition-all hover:bg-[var(--admin-primary-strong)] active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Opening builder...
                </>
              ) : (
                "Create and continue to builder"
              )}
            </button>
            <Link
              href={FORMS_LIST_HREF}
              prefetch={false}
              className="inline-flex items-center gap-1 text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
            >
              Cancel
              <X className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
