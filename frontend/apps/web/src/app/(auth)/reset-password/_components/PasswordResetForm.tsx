"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
const loadPublicPasswordResetCompleteSchema = () =>
  import("@atlas/contracts/domain-identity/schemas/public-auth").then(
    (module) => module.PublicPasswordResetCompleteSchema,
  );
const loadPublicPasswordResetRequestSchema = () =>
  import("@atlas/contracts/domain-identity/schemas/public-auth").then(
    (module) => module.PublicPasswordResetRequestSchema,
  );
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLazyZodForm } from "@/lib/forms/use-lazy-zod-form";
import { HiddenFormField } from "@/lib/forms/hidden-form-field";
import { valuesToFormData } from "@/lib/forms/values-to-form-data";
import {
  completePasswordResetAction,
  requestPasswordResetAction,
  type ResetPasswordActionState,
} from "../_actions/reset-password-action";

const fieldLabelClass = "mb-2 block text-[13px] font-semibold text-[var(--fba-tx2)]";

const fieldInputClass =
  "w-full rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] px-4 py-3 text-[15px] text-[var(--fba-tx)] outline-none transition-colors placeholder:text-[var(--fba-tx3)] focus:border-[var(--fba-ind)] aria-[invalid=true]:border-[var(--fba-red)]";

const primaryButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--fba-ind)] px-4 py-4 text-[15px] font-bold text-white shadow-[0_10px_40px_rgba(0,0,0,0.07)] transition-colors hover:bg-[var(--fba-ind-d)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" />
        </>
      )}
    </svg>
  );
}

function KeyIcon() {
  // Material Symbols "key" (filled) — same glyph used in the reference design.
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="transition-transform group-hover:-translate-x-1"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

const initialState: ResetPasswordActionState = {
  ok: false,
  message: "",
  requestId: "",
};

export function PasswordResetForm() {
  const [requestState, requestAction, requestPending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );
  const [completeState, completeAction, completePending] = useActionState(
    completePasswordResetAction,
    initialState,
  );
  const [recoveryTokens, setRecoveryTokens] = useState<{
    accessToken: string;
    refreshToken: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const requestForm = useLazyZodForm({
    schema: loadPublicPasswordResetRequestSchema,
    errorField: "email",
    defaultValues: {
      email: "",
    },
  });

  const completeForm = useLazyZodForm({
    schema: loadPublicPasswordResetCompleteSchema,
    errorField: "password",
    defaultValues: {
      password: "",
      accessToken: "",
      refreshToken: "",
    },
  });

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (type === "recovery" && accessToken) {
      const tokens = {
        accessToken,
        refreshToken: refreshToken ?? "",
      };
      setRecoveryTokens(tokens);
      completeForm.setValue("accessToken", tokens.accessToken);
      completeForm.setValue("refreshToken", tokens.refreshToken);
    }
  }, [completeForm]);

  if (recoveryTokens) {
    return (
      <Form {...completeForm}>
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[14px] border border-[var(--fba-ind)]/15 bg-[var(--fba-ind-l)] text-[var(--fba-ind-tx)]">
            <KeyIcon />
          </div>
          <h2
            id="complete-reset-title"
            className="mb-2 text-[28px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[var(--fba-tx)]"
          >
            Choose a new password
          </h2>
          <p className="max-w-[340px] text-[15px] leading-[1.6] text-[var(--fba-tx2)]">
            Pick a strong password you don&apos;t use anywhere else.
          </p>
        </div>

        <form
          aria-labelledby="complete-reset-title"
          className="space-y-4"
          onSubmit={(event) => {
            void completeForm.handleSubmit((values) => {
              completeAction(valuesToFormData(values));
            })(event);
          }}
        >
          <HiddenFormField control={completeForm.control} name="accessToken" />
          <HiddenFormField control={completeForm.control} name="refreshToken" />

          <FormField
            control={completeForm.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <FormLabel className={fieldLabelClass}>New password</FormLabel>
                <div className="relative">
                  <FormControl>
                    <input
                      {...field}
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      className={`${fieldInputClass} pr-12`}
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPassword((prev) => !prev);
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fba-tx3)] transition-colors hover:text-[var(--fba-tx)]"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                <FormMessage className="mt-2 text-[13px] text-[var(--fba-red-tx)]" />
              </FormItem>
            )}
          />

          {completeState.message ? (
            <p
              role="alert"
              className={
                completeState.ok
                  ? "text-[13px] text-[var(--fba-grn)]"
                  : "text-[13px] text-[var(--fba-red-tx)]"
              }
            >
              {completeState.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={completePending || completeForm.formState.isSubmitting}
            className={primaryButtonClass}
          >
            {completePending || completeForm.formState.isSubmitting
              ? "Updating..."
              : "Update password"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--fba-ind-tx)] transition-colors hover:text-[var(--fba-ind-d)]"
          >
            <ArrowLeftIcon />
            Back to Sign In
          </Link>
        </div>
      </Form>
    );
  }

  return (
    <Form {...requestForm}>
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[14px] border border-[var(--fba-ind)]/15 bg-[var(--fba-ind-l)] text-[var(--fba-ind-tx)]">
          <KeyIcon />
        </div>
        <h2
          id="request-reset-title"
          className="mb-2 text-[28px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[var(--fba-tx)]"
        >
          Reset your password
        </h2>
        <p className="max-w-[360px] text-[15px] leading-[1.6] text-[var(--fba-tx2)]">
          Enter your email and we&apos;ll send reset instructions if an account exists.
        </p>
      </div>

      <form
        aria-labelledby="request-reset-title"
        className="space-y-4"
        onSubmit={(event) => {
          void requestForm.handleSubmit((values) => {
            requestAction(valuesToFormData(values));
          })(event);
        }}
      >
        <FormField
          control={requestForm.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fieldLabelClass}>Email</FormLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fba-tx3)]">
                  <MailIcon />
                </span>
                <FormControl>
                  <input
                    {...field}
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    className={`${fieldInputClass} pl-12`}
                  />
                </FormControl>
              </div>
              <FormMessage className="mt-2 text-[13px] text-[var(--fba-red-tx)]" />
            </FormItem>
          )}
        />

        {requestState.message ? (
          <p
            role="status"
            className={
              requestState.ok
                ? "text-[13px] text-[var(--fba-grn)]"
                : "text-[13px] text-[var(--fba-tx2)]"
            }
          >
            {requestState.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={requestPending || requestForm.formState.isSubmitting}
          className={primaryButtonClass}
        >
          {requestPending || requestForm.formState.isSubmitting ? "Sending..." : "Send Reset Link"}
          {requestPending || requestForm.formState.isSubmitting ? null : <ArrowRightIcon />}
        </button>
      </form>

      <div className="mt-8 text-center">
        <Link
          href="/login"
          className="group inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--fba-ind-tx)] transition-colors hover:text-[var(--fba-ind-d)]"
        >
          <ArrowLeftIcon />
          Back to Sign In
        </Link>
      </div>

      <div className="mt-10 flex items-start gap-4 rounded-[14px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-bg2)] p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--fba-gld-l)] text-[var(--fba-gld)]">
          <HelpIcon />
        </div>
        <div>
          <h3 className="mb-1 text-[14px] font-bold text-[var(--fba-tx)]">Need help?</h3>
          <p className="text-[13px] leading-[1.6] text-[var(--fba-tx2)]">
            If you&apos;re having trouble accessing your account, reach out to our support team and
            we&apos;ll help you get back in.
          </p>
        </div>
      </div>
    </Form>
  );
}
