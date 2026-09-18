"use client";

import { useCallback, useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { ClientApiError, clientApi } from "../../lib/client-api";
import { useAccountTheme } from "../account-settings/account-theme-context";
import { SecuritySection } from "./security-section";

type Identity = {
  id: string;
  provider: string;
  email?: string | null;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Something went wrong. Please try again.";
}

function providerLabel(provider: string): string {
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function ConnectedAccounts() {
  const { classes } = useAccountTheme();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await clientApi.get<{ data: { identities: Identity[] } }>(
      "/api/v1/me/security/identities",
    );
    setIdentities(response.data.identities);
  }, []);

  useEffect(() => {
    void load().catch(() => {
      setMessage("Unable to load connected accounts.");
    });
  }, [load]);

  async function linkProvider(provider: "google" | "apple") {
    setBusy(true);
    setMessage(null);
    try {
      const redirectTo = `${window.location.origin}/profile/security`;
      const response = await clientApi.post<{ data: { url: string } }>(
        "/api/v1/me/security/identities/link",
        { provider, redirectTo },
        `link-${provider}`,
      );
      window.location.href = response.data.url;
    } catch (error) {
      setMessage(formatError(error));
      setBusy(false);
    }
  }

  async function unlink(identityId: string) {
    setBusy(true);
    setMessage(null);
    try {
      await clientApi.delete(`/api/v1/me/security/identities/${identityId}`, "unlink-identity");
      await load();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  const linkedProviders = new Set(identities.map((identity) => identity.provider));
  const providers: Array<"google" | "apple"> = ["google", "apple"];

  return (
    <SecuritySection
      title="Connected accounts"
      description="Manage third-party services you've connected to your account for faster sign-in."
    >
      <div className="space-y-4">
        {providers.map((provider) => {
          const identity = identities.find((item) => item.provider === provider);
          return (
            <div
              key={provider}
              className="flex items-center justify-between rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface-lowest)] p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface-low)] text-sm font-bold text-[var(--acct-on-surface)]">
                  {providerLabel(provider).charAt(0)}
                </div>
                <div>
                  <p className={classes.sectionTitle}>{providerLabel(provider)}</p>
                  <p className={classes.helper}>
                    {identity?.email
                      ? `Connected as ${identity.email}`
                      : "Connect your account for single sign-on"}
                  </p>
                </div>
              </div>
              {identity ? (
                identities.length > 1 ? (
                  <button
                    type="button"
                    className={classes.dangerOutlineButton}
                    disabled={busy}
                    onClick={() => {
                      void unlink(identity.id);
                    }}
                  >
                    Disconnect
                  </button>
                ) : null
              ) : (
                <button
                  type="button"
                  className={classes.primaryButton}
                  disabled={busy}
                  onClick={() => {
                    void linkProvider(provider);
                  }}
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
        {linkedProviders.size === 0 ? (
          <p className={classes.helper}>No connected accounts yet.</p>
        ) : null}
        {message ? <p className={classes.helper}>{message}</p> : null}
      </div>
    </SecuritySection>
  );
}

export function SignOutOtherSessionsCard() {
  const { classes } = useAccountTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function revokeOthers() {
    setBusy(true);
    setMessage(null);
    try {
      await clientApi.post(
        "/api/v1/me/security/sessions/revoke-others",
        {},
        "revoke-other-sessions",
      );
      setMessage("Signed out of all other devices.");
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SecuritySection
      title="Active sessions"
      description="Sign out everywhere else you're signed in, keeping this device signed in."
    >
      <div className={`${classes.card} space-y-4`}>
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-[var(--acct-primary-container)] p-2 text-[var(--acct-on-primary-container)]">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--acct-on-surface)]">This device</p>
            <p className={classes.helper}>Your current session stays active.</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className={classes.outlineButton}
            disabled={busy}
            onClick={() => {
              void revokeOthers();
            }}
          >
            {busy ? "Signing out…" : "Sign out of other devices"}
          </button>
        </div>
        {message ? <p className={classes.helper}>{message}</p> : null}
      </div>
    </SecuritySection>
  );
}
