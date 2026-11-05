"use client";

import { useState, type SyntheticEvent } from "react";
import { platformApi, PlatformApiError } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonDialog, PlatformReasonGate } from "./PlatformReasonDialog";

/**
 * P10 -- account review: find the account behind an email, and disable or
 * re-enable it. A disabled account is signed out on its next request.
 */

type AccountStatus = "active" | "unclaimed" | "disabled";

type Account = {
  id: string;
  email: string;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  activeMembershipCount: number;
  platformRole: string | null;
};

type PendingAction = { account: Account; status: "active" | "disabled" };

const STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  unclaimed: "Not yet claimed",
  disabled: "Disabled",
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof PlatformApiError || error instanceof Error ? error.message : fallback;
}

function dialogCopy(action: PendingAction): {
  title: string;
  description: string;
  confirm: string;
} {
  return action.status === "disabled"
    ? {
        title: "Disable account",
        description: `${action.account.email} will be signed out of every academy and the platform console on their next request.`,
        confirm: "Disable",
      }
    : {
        title: "Enable account",
        description: `${action.account.email} will be able to sign in again.`,
        confirm: "Enable",
      };
}

export function PlatformAccountReview() {
  const { reason, isValid } = usePlatformReason();
  const [lookupEmail, setLookupEmail] = useState("");
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  async function lookUp(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) return;
    setActionError(null);
    try {
      const response = await platformApi.get<{ data: Account | null }>(
        `/api/v1/platform/accounts?${new URLSearchParams({ email: lookupEmail.trim() }).toString()}`,
        reason,
      );
      setAccount(response.data);
    } catch (error) {
      setAccount(undefined);
      setActionError(describeError(error, "Account lookup failed."));
    }
  }

  async function confirmAction() {
    if (!reason || !pending) return;
    setActionError(null);
    try {
      const response = await platformApi.post<{ data: Account }>(
        `/api/v1/platform/accounts/${pending.account.id}/status`,
        { status: pending.status, reason: actionReason },
        reason,
        "platform-account-status",
      );
      setAccount(response.data);
      setPending(null);
      setActionReason("");
    } catch (error) {
      setPending(null);
      setActionError(describeError(error, "The action failed."));
    }
  }

  const copy = pending ? dialogCopy(pending) : null;

  return (
    <PlatformReasonGate ready={isValid}>
      <section className="space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            Find the account behind an email to disable or re-enable it. Record the support ticket
            behind each change.
          </p>
        </header>

        {actionError ? (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        ) : null}

        <section aria-labelledby="lookup-heading" className="space-y-3">
          <h2 id="lookup-heading" className="text-lg font-semibold">
            Find an account
          </h2>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              void lookUp(event);
            }}
          >
            <label className="block text-sm">
              Email
              <input
                type="email"
                className="mt-1 block rounded border border-input bg-background px-3 py-2 text-foreground"
                value={lookupEmail}
                onChange={(event) => {
                  setLookupEmail(event.target.value);
                }}
                required
              />
            </label>
            <button
              type="submit"
              className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Look up
            </button>
          </form>

          {account === null ? (
            <p className="text-sm text-muted-foreground">No account uses that email.</p>
          ) : account ? (
            <dl className="grid max-w-xl grid-cols-[max-content_1fr] gap-x-6 gap-y-2 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{account.email}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{STATUS_LABEL[account.status]}</dd>
              <dt className="text-muted-foreground">Last sign-in</dt>
              <dd>{formatDate(account.lastLoginAt)}</dd>
              <dt className="text-muted-foreground">Active memberships</dt>
              <dd className="tabular-nums">{account.activeMembershipCount}</dd>
              <dt className="text-muted-foreground">Platform role</dt>
              <dd>{account.platformRole ?? "None"}</dd>
              {account.status === "unclaimed" ? null : (
                <dd className="col-span-2 pt-2">
                  <button
                    type="button"
                    className={
                      account.status === "active"
                        ? "rounded border border-destructive px-3 py-1.5 text-destructive hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        : "rounded bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    }
                    onClick={() => {
                      setPending({
                        account,
                        status: account.status === "active" ? "disabled" : "active",
                      });
                    }}
                  >
                    {account.status === "active" ? "Disable account" : "Enable account"}
                  </button>
                </dd>
              )}
            </dl>
          ) : null}
        </section>
      </section>

      <PlatformReasonDialog
        open={pending !== null}
        title={copy?.title ?? ""}
        description={`${copy?.description ?? ""} Record the support ticket and why (at least 10 characters).`}
        confirmLabel={copy?.confirm ?? "Confirm"}
        value={actionReason}
        onChange={setActionReason}
        onConfirm={() => {
          void confirmAction();
        }}
        onCancel={() => {
          setPending(null);
        }}
      />
    </PlatformReasonGate>
  );
}
