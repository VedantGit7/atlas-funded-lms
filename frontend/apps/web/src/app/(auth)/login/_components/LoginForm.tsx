"use client";

import { useActionState, useEffect, startTransition, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PublicLoginRequestSchema,
  PublicMfaVerifyRequestSchema,
} from "@atlas/contracts/domain-identity/schemas/public-auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useZodForm } from "@/lib/forms/use-zod-form";
import { HiddenFormField } from "@/lib/forms/hidden-form-field";
import { valuesToFormData } from "@/lib/forms/values-to-form-data";
import { loginAction, type LoginActionState } from "../_actions/login-action";
import { verifyMfaAction, type VerifyMfaActionState } from "../_actions/verify-mfa-action";
import { OtpInput } from "./OtpInput";
import { VerificationSuccess } from "./VerificationSuccess";
import { VerificationFailed } from "./VerificationFailed";
import { MagicLinkPanel } from "./MagicLinkPanel";

const fieldLabelClass = "mb-2 block text-[13px] font-semibold text-[var(--fba-tx2)]";

const fieldInputClass =
  "w-full rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] px-4 py-3 text-[15px] text-[var(--fba-tx)] outline-none transition-colors placeholder:text-[var(--fba-tx3)] focus:border-[var(--fba-ind)] aria-[invalid=true]:border-[var(--fba-red)]";

const primaryButtonClass =
  "w-full rounded-[10px] bg-[var(--fba-ind)] px-4 py-4 text-[15px] font-bold text-white shadow-[0_10px_40px_rgba(0,0,0,0.07)] transition-colors hover:bg-[var(--fba-ind-d)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

const inlineLinkClass =
  "text-[13px] font-semibold text-[var(--fba-ind)] transition-colors hover:underline";

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

const initialLoginState: LoginActionState = {
  ok: false,
  message: "",
  requestId: "",
};

const initialMfaState: VerifyMfaActionState = {
  ok: false,
  message: "",
  requestId: "",
};

const SENSITIVE_LOGIN_SEARCH_PARAMS = ["email", "password"] as const;

function stripSensitiveLoginSearchParams(): void {
  const url = new URL(window.location.href);
  let changed = false;

  for (const key of SENSITIVE_LOGIN_SEARCH_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  if (changed) {
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }
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

function ShieldCheckIcon() {
  // Material Symbols "verified_user" (filled).
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
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

const SOCIAL_PROVIDERS = [
  {
    id: "google",
    label: "Google",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden focusable="false">
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
    ),
  },
  {
    id: "apple",
    label: "Apple",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        focusable="false"
      >
        <path d="M17.05 12.54c-.02-2.07 1.69-3.06 1.77-3.11-.96-1.41-2.46-1.6-2.99-1.62-1.27-.13-2.49.75-3.13.75-.65 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.38 2.05-1.44 2.5-.37 6.2 1.04 8.23.69.99 1.51 2.1 2.58 2.06 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.6.67 2.7.65 1.11-.02 1.82-1.01 2.5-2.01.79-1.15 1.11-2.27 1.13-2.33-.02-.01-2.17-.83-2.19-3.31zM15.02 6.2c.57-.69.96-1.65.85-2.6-.82.03-1.82.55-2.41 1.23-.53.61-.99 1.58-.87 2.51.91.07 1.85-.46 2.43-1.14z" />
      </svg>
    ),
  },
] as const;

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") ?? undefined;
  const oauthFailed = searchParams.get("error") === "oauth";
  const verified = searchParams.get("verified") === "1";
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  // True once the user dismisses a verification failure to retry; reset on each
  // new MFA submission so a fresh rejection re-shows the failure screen.
  const [mfaRetried, setMfaRetried] = useState(false);

  const buildSocialHref = (provider: string) => {
    const params = new URLSearchParams();
    params.set("remember", rememberMe ? "1" : "0");
    if (redirectTo) {
      params.set("next", redirectTo);
    }
    return `/auth/oauth/${provider}?${params.toString()}`;
  };

  useEffect(() => {
    stripSensitiveLoginSearchParams();
  }, []);
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    initialLoginState,
  );
  const [mfaState, mfaFormAction, mfaPending] = useActionState(verifyMfaAction, initialMfaState);

  // Navigate via a full browser navigation rather than calling redirect() inside
  // the server action: redirect()-from-action triggers Next's combined
  // action+RSC-render response, and the destination's parallel data loaders can
  // lose request context in that path. A plain navigation after the action
  // resolves avoids it entirely.
  useEffect(() => {
    if (loginState.ok && loginState.destination) {
      window.location.href = loginState.destination;
    }
  }, [loginState.ok, loginState.destination]);

  useEffect(() => {
    if (mfaState.ok && mfaState.destination) {
      window.location.href = mfaState.destination;
    }
  }, [mfaState.ok, mfaState.destination]);

  const loginForm = useZodForm({
    schema: PublicLoginRequestSchema,
    defaultValues: {
      email: "",
      password: "",
      redirectTo,
    },
  });

  const mfaForm = useZodForm({
    schema: PublicMfaVerifyRequestSchema,
    defaultValues: {
      code: "",
    },
  });

  // While the post-auth browser navigation is in flight, show the branded
  // success screen instead of leaving the form (and the inline "Verified."
  // text) on screen.
  if (mfaState.ok && mfaState.destination) {
    return <VerificationSuccess destination={mfaState.destination} />;
  }

  if (loginState.ok && loginState.destination) {
    return (
      <VerificationSuccess
        destination={loginState.destination}
        title="You're signed in"
        message="Sign-in confirmed. Taking you to your dashboard…"
      />
    );
  }

  if (loginState.mfaRequired) {
    const mfaRejected = Boolean(mfaState.message) && !mfaState.ok;

    if (mfaRejected && !mfaRetried) {
      return (
        <VerificationFailed
          message={mfaState.message}
          onRetry={() => {
            setMfaRetried(true);
            mfaForm.reset({ code: "" });
          }}
        />
      );
    }

    return (
      <Form {...mfaForm}>
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[14px] border border-[var(--fba-ind)]/15 bg-[var(--fba-ind-l)] text-[var(--fba-ind)]">
            <ShieldCheckIcon />
          </div>
          <h2
            id="mfa-title"
            className="mb-2 text-[28px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[var(--fba-tx)]"
          >
            Two-factor verification
          </h2>
          <p className="max-w-[340px] text-[15px] leading-[1.6] text-[var(--fba-tx2)]">
            Enter the 6-digit code from your authenticator app to finish signing in.
          </p>
        </div>

        <form
          aria-labelledby="mfa-title"
          className="space-y-5"
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            void mfaForm.handleSubmit((values) => {
              setMfaRetried(false);
              const formData = valuesToFormData(values);
              if (loginState.redirectTo) {
                formData.set("redirectTo", loginState.redirectTo);
              }
              startTransition(() => {
                mfaFormAction(formData);
              });
            })(event);
          }}
        >
          <FormField
            control={mfaForm.control}
            name="code"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <FormControl>
                  <OtpInput
                    value={field.value}
                    onChange={field.onChange}
                    length={6}
                    autoFocus
                    disabled={mfaPending}
                    invalid={!mfaRetried && Boolean(mfaState.message && !mfaState.ok)}
                    ariaLabel="Authenticator verification code"
                  />
                </FormControl>
                <FormMessage className="mt-2 text-center text-[13px] text-[var(--fba-red)]" />
              </FormItem>
            )}
          />

          {mfaState.message && !mfaRetried ? (
            <p
              role="alert"
              className={
                mfaState.ok
                  ? "text-center text-[13px] text-[var(--fba-grn)]"
                  : "text-center text-[13px] text-[var(--fba-red)]"
              }
            >
              {mfaState.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={mfaPending}
            className={`flex items-center justify-center gap-2 ${primaryButtonClass}`}
          >
            {mfaPending ? "Verifying..." : "Verify code"}
            {mfaPending ? null : <ArrowRightIcon />}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--fba-ind)] transition-colors hover:text-[var(--fba-ind-d)]"
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
            <h3 className="mb-1 text-[14px] font-bold text-[var(--fba-tx)]">Having trouble?</h3>
            <p className="text-[13px] leading-[1.6] text-[var(--fba-tx2)]">
              If you&apos;ve lost access to your authenticator device, contact our support team to
              recover your account.
            </p>
          </div>
        </div>
      </Form>
    );
  }

  return (
    <Form {...loginForm}>
      <div className="mb-8">
        <h2
          id="login-title"
          className="mb-2 text-[32px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[var(--fba-tx)]"
        >
          Sign in to your account
        </h2>
        <p className="text-[15px] leading-[1.6] text-[var(--fba-tx2)]">
          New to FundedBeyond?{" "}
          <Link href="/signup" className={inlineLinkClass}>
            Create a free account
          </Link>
        </p>
      </div>

      {verified ? (
        <div
          role="status"
          className="mb-6 rounded-[10px] border border-[var(--fba-grn)]/30 bg-[var(--fba-grn)]/10 px-4 py-3 text-[13px] font-medium text-[var(--fba-grn)]"
        >
          Your email is verified. Sign in to continue.
        </div>
      ) : null}

      <form
        aria-labelledby="login-title"
        className="space-y-4"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          void loginForm.handleSubmit((values) => {
            const formData = valuesToFormData({
              email: values.email,
              password: values.password,
              redirectTo: values.redirectTo,
            });
            formData.set("rememberMe", rememberMe ? "true" : "false");
            startTransition(() => {
              loginFormAction(formData);
            });
          })(event);
        }}
      >
        {redirectTo ? <HiddenFormField control={loginForm.control} name="redirectTo" /> : null}

        <FormField
          control={loginForm.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fieldLabelClass}>Email</FormLabel>
              <FormControl>
                <input
                  {...field}
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  className={fieldInputClass}
                />
              </FormControl>
              <FormMessage className="mt-2 text-[13px] text-[var(--fba-red)]" />
            </FormItem>
          )}
        />

        <FormField
          control={loginForm.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <div className="mb-2 flex items-center justify-between">
                <FormLabel className="text-[13px] font-semibold text-[var(--fba-tx2)]">
                  Password
                </FormLabel>
                <Link href="/reset-password" className={inlineLinkClass}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <FormControl>
                  <input
                    {...field}
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
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
              <FormMessage className="mt-2 text-[13px] text-[var(--fba-red)]" />
            </FormItem>
          )}
        />

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="rememberMe"
            checked={rememberMe}
            onChange={(event) => {
              setRememberMe(event.target.checked);
            }}
            className="h-[18px] w-[18px] rounded border-[1.5px] border-[var(--fba-bdr2)] accent-[var(--fba-ind)]"
          />
          <span className="text-[13px] font-medium text-[var(--fba-tx2)]">Remember me</span>
        </label>

        {loginState.message || oauthFailed ? (
          <p
            role="alert"
            className={
              loginState.ok
                ? "text-[13px] text-[var(--fba-grn)]"
                : "text-[13px] text-[var(--fba-red)]"
            }
          >
            {loginState.message || "We couldn't sign you in with that provider. Please try again."}
          </p>
        ) : null}

        <button type="submit" disabled={loginPending} className={primaryButtonClass}>
          {loginPending ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <MagicLinkPanel />

      <div className="my-6 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[var(--fba-bdr)]" />
        <span className="text-[12px] font-medium text-[var(--fba-tx3)]">Or continue with</span>
        <span className="h-px flex-1 bg-[var(--fba-bdr)]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SOCIAL_PROVIDERS.map((provider) => (
          <a
            key={provider.id}
            href={buildSocialHref(provider.id)}
            className="flex items-center justify-center gap-2.5 rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] px-4 py-3 text-[14px] font-semibold text-[var(--fba-tx)] transition-colors hover:border-[var(--fba-tx3)] hover:bg-[var(--fba-bg2)]"
          >
            {provider.icon}
            {provider.label}
          </a>
        ))}
      </div>

      <p className="mt-6 text-center text-[12px] leading-[1.6] text-[var(--fba-tx3)]">
        By signing in, you acknowledge that you have read, understood, and agree to our{" "}
        <Link href="/terms" className={inlineLinkClass}>
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className={inlineLinkClass}>
          Privacy Policy
        </Link>
        .
      </p>
    </Form>
  );
}
