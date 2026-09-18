"use client";

import { SafeHtml } from "@/components/SafeHtml";
import { useCallback, useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { ClientApiError, clientApi } from "../../lib/client-api";
import { useAccountTheme } from "../account-settings/account-theme-context";
import { SecuritySection } from "./security-section";

type MfaFactor = {
  id: string;
  factorType: string;
  status: string;
  friendlyName?: string | null;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Something went wrong. Please try again.";
}

function MfaQrCode({ qrCode }: { qrCode: string }) {
  const { classes } = useAccountTheme();
  const value = qrCode.trim();

  if (value.startsWith("data:image")) {
    return (
      <div className="flex justify-center overflow-hidden rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface)] p-4">
        <img
          src={value}
          alt="Scan this code with your authenticator app"
          className="h-44 w-44 max-w-full object-contain"
        />
      </div>
    );
  }

  if (value.startsWith("<svg") || value.startsWith("<?xml")) {
    return (
      <SafeHtml
        html={value}
        variant="svg"
        className={`flex justify-center overflow-hidden rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface)] p-4 [&>svg]:h-44 [&>svg]:w-44 [&>svg]:max-w-full ${classes.field}`}
      />
    );
  }

  return null;
}

type MfaManagerProps = Readonly<{
  highlight?: boolean;
  continuePath?: string | null;
}>;

export function MfaManager({ highlight = false, continuePath = null }: MfaManagerProps) {
  const { classes } = useAccountTheme();
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [enroll, setEnroll] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    const response = await clientApi.get<{ data: { factors: MfaFactor[] } }>(
      "/api/v1/me/security/mfa",
    );
    setFactors(response.data.factors);
  }, []);

  useEffect(() => {
    void loadFactors().catch(() => {
      setMessage("Unable to load MFA settings.");
    });
  }, [loadFactors]);

  async function startEnroll() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await clientApi.post<{
        data: { factorId: string; qrCode: string; secret: string; uri: string };
      }>("/api/v1/me/security/mfa", {}, "mfa-enroll");
      setEnroll({
        factorId: response.data.factorId,
        qrCode: response.data.qrCode,
        secret: response.data.secret,
      });
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnroll() {
    if (!enroll) return;
    setBusy(true);
    setMessage(null);
    try {
      await clientApi.post(
        "/api/v1/me/security/mfa/verify",
        { factorId: enroll.factorId, code },
        "mfa-verify-enroll",
      );
      setEnroll(null);
      setCode("");
      setMessage("Two-factor authentication enabled.");
      await loadFactors();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factorId: string) {
    setBusy(true);
    setMessage(null);
    try {
      await clientApi.delete(`/api/v1/me/security/mfa/${factorId}`, "mfa-unenroll");
      await loadFactors();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  const hasVerifiedFactor = factors.some((factor) => factor.status === "verified");

  return (
    <SecuritySection
      title="Two-factor authentication"
      description="Add an additional layer of security to your account by requiring more than just a password to log in."
    >
      <div
        className={`${classes.card} space-y-4${highlight ? " ring-2 ring-[var(--acct-primary-container)] ring-offset-2 ring-offset-[var(--acct-bg)]" : ""}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-[var(--acct-primary-container)] p-2 text-[var(--acct-on-primary-container)]">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className={classes.sectionTitle}>Authenticator app</p>
              <p className={classes.sectionDesc}>
                Use an app like Google Authenticator or Authy to generate secure codes.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hasVerifiedFactor}
            aria-label="Toggle two-factor authentication"
            disabled={busy || Boolean(enroll)}
            onClick={() => {
              if (hasVerifiedFactor && factors[0]) {
                void removeFactor(factors[0].id);
              } else {
                void startEnroll();
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${hasVerifiedFactor ? classes.toggleTrackOn : classes.toggleTrackOff}`}
          >
            <span
              className={`${classes.toggleKnob} ${hasVerifiedFactor ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>

        {factors.length > 0 ? (
          <ul className="space-y-2">
            {factors.map((factor) => (
              <li
                key={factor.id}
                className="flex items-center justify-between rounded-lg border border-[var(--acct-border)] px-4 py-3"
              >
                <span className="text-sm text-[var(--acct-on-surface)]">
                  {factor.friendlyName ?? factor.factorType} ({factor.status})
                </span>
                <button
                  type="button"
                  className={classes.outlineButton}
                  disabled={busy}
                  onClick={() => {
                    void removeFactor(factor.id);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {enroll ? (
          <form
            className="space-y-3 border-t border-[var(--acct-border)] pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyEnroll();
            }}
          >
            <MfaQrCode qrCode={enroll.qrCode} />
            <p className={classes.helper}>Manual key: {enroll.secret}</p>
            <input
              type="text"
              inputMode="numeric"
              className={classes.field}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
              }}
              required
            />
            <button type="submit" className={classes.primaryButton} disabled={busy}>
              {busy ? "Verifying…" : "Verify and enable"}
            </button>
          </form>
        ) : null}

        {message ? <p className={classes.helper}>{message}</p> : null}

        {hasVerifiedFactor && continuePath ? (
          <a href={continuePath} className={`${classes.primaryButton} inline-flex`}>
            Continue to {continuePath}
          </a>
        ) : null}
      </div>
    </SecuritySection>
  );
}
