"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  captureUtmFromSearchParams,
  persistUtmAttribution,
  sendSignupAttributionEvent,
} from "@/lib/attribution/utm-storage";
import { PublicSignupRequestSchema } from "@atlas/contracts/domain-identity/schemas/public-auth";
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
import { signupAction, type SignupActionState } from "../_actions/signup-action";

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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
        <path d="M17.05 12.54c-.02-2.07 1.69-3.06 1.77-3.11-.96-1.41-2.46-1.6-2.99-1.62-1.27-.13-2.49.75-3.13.75-.65 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.38 2.05-1.44 2.5-.37 6.2 1.04 8.23.69.99 1.51 2.1 2.58 2.06 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.6.67 2.7.65 1.11-.02 1.82-1.01 2.5-2.01.79-1.15 1.11-2.27 1.13-2.33-.02-.01-2.17-.83-2.19-3.31zM15.02 6.2c.57-.69.96-1.65.85-2.6-.82.03-1.82.55-2.41 1.23-.53.61-.99 1.58-.87 2.51.91.07 1.85-.46 2.43-1.14z" />
      </svg>
    ),
  },
] as const;

const initialState: SignupActionState = {
  ok: false,
  message: "",
  requestId: "",
};

export function SignupForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("inviteToken") ?? searchParams.get("token") ?? "";
  const referralCodeFromUrl = (searchParams.get("ref") ?? searchParams.get("referralCode") ?? "")
    .trim()
    .toUpperCase();
  const redirectTo = searchParams.get("next") ?? undefined;
  const oauthFailed = searchParams.get("error") === "oauth";
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [referralsEnabled, setReferralsEnabled] = useState(Boolean(referralCodeFromUrl));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/v1/public/referral/status", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const json = (await response.json()) as { data?: { enabled?: boolean } };
        if (!cancelled) {
          setReferralsEnabled(Boolean(json.data?.enabled) || Boolean(referralCodeFromUrl));
        }
      } catch {
        // Keep field visible if URL already has a referral code.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [referralCodeFromUrl]);

  // After a successful signup the account exists but is unverified. Route to the
  // dedicated verify-email screen (full navigation, matching the sign-in flow)
  // so the learner gets clear "check your inbox" guidance and a resend control.
  useEffect(() => {
    const attribution = captureUtmFromSearchParams(searchParams);
    if (attribution) {
      persistUtmAttribution(attribution);
    }
  }, [searchParams]);

  useEffect(() => {
    if (state.verificationRequired) {
      void sendSignupAttributionEvent({ eventType: "signup" });
      const params = new URLSearchParams({ status: "sent" });
      if (state.email) {
        params.set("email", state.email);
      }
      window.location.href = `/verify-email?${params.toString()}`;
    }
  }, [state.verificationRequired, state.email]);

  const buildSocialHref = (provider: string) => {
    const params = new URLSearchParams();
    params.set("remember", "0");
    if (redirectTo) {
      params.set("next", redirectTo);
    }
    return `/auth/oauth/${provider}?${params.toString()}`;
  };

  const form = useZodForm({
    schema: PublicSignupRequestSchema,
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      inviteToken: inviteToken || undefined,
      referralCode: referralCodeFromUrl || undefined,
    },
  });

  return (
    <Form {...form}>
      <div className="mb-8">
        <h2
          id="signup-title"
          className="mb-2 text-[32px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[var(--fba-tx)]"
        >
          Create your account
        </h2>
        <p className="text-[15px] leading-[1.6] text-[var(--fba-tx2)]">
          Already have an account?{" "}
          <Link href="/login" className={inlineLinkClass}>
            Sign In
          </Link>
        </p>
      </div>

      <form
        aria-labelledby="signup-title"
        className="space-y-4"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit((values) => {
            if (values.password !== confirmPassword) {
              setConfirmError("Passwords do not match.");
              return;
            }
            setConfirmError("");
            formAction(valuesToFormData(values));
          })(event);
        }}
      >
        {inviteToken ? <HiddenFormField control={form.control} name="inviteToken" /> : null}

        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fieldLabelClass}>Full name</FormLabel>
              <FormControl>
                <input
                  {...field}
                  required
                  type="text"
                  autoComplete="name"
                  placeholder="Jordan Mensah"
                  className={fieldInputClass}
                />
              </FormControl>
              <FormMessage className="mt-2 text-[13px] text-[var(--fba-red)]" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
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

        {referralsEnabled ? (
          <FormField
            control={form.control}
            name="referralCode"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <FormLabel className={fieldLabelClass}>Referral code (optional)</FormLabel>
                <FormControl>
                  <input
                    {...field}
                    value={field.value ?? ""}
                    type="text"
                    autoComplete="off"
                    placeholder="Friend's referral code"
                    className={fieldInputClass}
                    onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage className="mt-2 text-[13px] text-[var(--fba-red)]" />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fieldLabelClass}>Password</FormLabel>
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
                  onClick={() => setShowPassword((prev) => !prev)}
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

        <div className="space-y-0">
          <label htmlFor="confirmPassword" className={fieldLabelClass}>
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              required
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (confirmError) setConfirmError("");
              }}
              aria-invalid={confirmError ? true : undefined}
              className={`${fieldInputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fba-tx3)] transition-colors hover:text-[var(--fba-tx)]"
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>
          {confirmError ? (
            <p className="mt-2 text-[13px] text-[var(--fba-red)]">{confirmError}</p>
          ) : null}
        </div>

        {state.message || oauthFailed ? (
          <p
            role="alert"
            className={
              state.ok ? "text-[13px] text-[var(--fba-grn)]" : "text-[13px] text-[var(--fba-red)]"
            }
          >
            {state.message ||
              "We couldn't sign you up with that provider. Please try again."}
          </p>
        ) : null}

        {state.verificationRequired ? (
          <p className="text-[13px] text-[var(--fba-tx2)]">
            After verifying your email, return here to sign in.
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[var(--fba-bdr)]" />
        <span className="text-[12px] font-medium text-[var(--fba-tx3)]">Or sign up with</span>
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
        By signing up, you acknowledge that you have read, understood, and agree to our{" "}
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
