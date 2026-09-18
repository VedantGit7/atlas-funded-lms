"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@atlas/design-system";
import {
  PublicLoginRequestSchema,
  PublicSignupRequestSchema,
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
import { clientApi } from "../../../lib/client-api";
import { diagnosticApiClient } from "@atlas/contracts-modules/diagnostics/diagnostic.api-client";

type DiagnosticIdentityGateProps = {
  anonymousId: string;
  open: boolean;
  onClose: () => void;
};

type PublicAuthResponse = {
  data: {
    status: string;
    redirectTo?: string | null;
  };
};

export function DiagnosticIdentityGate({
  anonymousId,
  open,
  onClose,
}: DiagnosticIdentityGateProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const signupForm = useZodForm({
    schema: PublicSignupRequestSchema,
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
    },
  });

  const loginForm = useZodForm({
    schema: PublicLoginRequestSchema,
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  async function submitSignup(values: { email: string; password: string; displayName: string }) {
    setStatus("loading");
    setMessage(null);

    try {
      await clientApi.post<PublicAuthResponse>(
        "/api/v1/public/auth/signup",
        values,
        "diagnostic-signup",
      );
      const mergeResult = await diagnosticApiClient.mergePublicDiagnostic(anonymousId);
      router.push(mergeResult.data.resultPath);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to create or sign in to your account.",
      );
    }
  }

  async function submitLogin(values: { email: string; password: string }) {
    setStatus("loading");
    setMessage(null);

    try {
      await clientApi.post<PublicAuthResponse>(
        "/api/v1/public/auth/login",
        values,
        "diagnostic-login",
      );
      const mergeResult = await diagnosticApiClient.mergePublicDiagnostic(anonymousId);
      router.push(mergeResult.data.resultPath);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to create or sign in to your account.",
      );
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="identity-gate-title"
      className="w-full max-w-md rounded border p-0 backdrop:bg-black/40"
      onClose={onClose}
    >
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="identity-gate-title" className="text-lg font-semibold">
              Save your diagnostic results
            </h2>
            <p className="mt-1 text-sm opacity-80">
              Create a free account or sign in to unlock your full scorecard and learning handoff.
            </p>
          </div>
          <button type="button" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded border px-3 py-1 ${mode === "signup" ? "font-semibold" : ""}`}
            onClick={() => {
              setMode("signup");
            }}
          >
            Create account
          </button>
          <button
            type="button"
            className={`rounded border px-3 py-1 ${mode === "login" ? "font-semibold" : ""}`}
            onClick={() => {
              setMode("login");
            }}
          >
            Sign in
          </button>
        </div>

        {mode === "signup" ? (
          <Form {...signupForm}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void signupForm.handleSubmit((values) => {
                  void submitSignup(values);
                })(event);
              }}
            >
              <FormField
                control={signupForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input {...field} required className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        required
                        type="email"
                        autoComplete="email"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        required
                        type="password"
                        autoComplete="new-password"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {message ? (
                <p role="alert" className="text-sm text-destructive-text">
                  {message}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="rounded border px-4 py-2 font-medium"
                >
                  {status === "loading" ? "Saving…" : "Continue"}
                </button>
                <Link
                  href={`/diagnostic/result?anonId=${anonymousId}`}
                  className="rounded border px-4 py-2"
                >
                  View scorecard only
                </Link>
              </div>
            </form>
          </Form>
        ) : (
          <Form {...loginForm}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void loginForm.handleSubmit((values) => {
                  void submitLogin(values);
                })(event);
              }}
            >
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        required
                        type="email"
                        autoComplete="email"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        required
                        type="password"
                        autoComplete="current-password"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {message ? (
                <p role="alert" className="text-sm text-destructive-text">
                  {message}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="rounded border px-4 py-2 font-medium"
                >
                  {status === "loading" ? "Saving…" : "Continue"}
                </button>
                <Link
                  href={`/diagnostic/result?anonId=${anonymousId}`}
                  className="rounded border px-4 py-2"
                >
                  View scorecard only
                </Link>
              </div>
            </form>
          </Form>
        )}
      </div>
    </dialog>
  );
}
