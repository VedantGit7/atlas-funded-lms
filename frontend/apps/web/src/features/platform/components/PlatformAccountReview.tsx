"use client";

import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { platformApi, PlatformApiError } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonDialog, PlatformReasonGate } from "./PlatformReasonDialog";

/**
 * P10 -- account review (audit H6).
 *
 * A sign-in never moves an account to a different Supabase user. When a
 * confirmed email signs in under a new one, the attempt waits here. Approval
 * is refused by the API unless the earlier sign-in has been deleted in
 * Supabase Auth, and any platform role on the account is revoked, not carried
 * across. The lookup below also disables or re-enables an account.
 */

type AccountStatus = "active" | "unclaimed" | "disabled";

type RelinkRequest = {
  id: string;
  principalId: string;
  email: string;
  accountStatus: AccountStatus;
  requestedAt: string;
  lastSeenAt: string;
  attemptCount: number;
  activeMembershipCount: number;
  platformRole: string | null;
};

type Account = {
  id: string;
  email: string;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  activeMembershipCount: number;
  platformRole: string | null;
  pendingRelinkRequestCount: number;
};

type PendingAction =
  | { kind: "approve"; request: RelinkRequest }
  | { kind: "reject"; request: RelinkRequest }
  | { kind: "status"; account: Account; status: "active" | "disabled" };

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
  switch (action.kind) {
    case "approve":
      return {
        title: "Approve relink",
        description: `Move ${action.request.email} to the new sign-in. This is refused unless the earlier sign-in has been deleted in Supabase Auth.${
          action.request.platformRole
            ? ` Its platform role (${action.request.platformRole}) will be revoked.`
            : ""
        }`,
        confirm: "Approve",
      };
    case "reject":
      return {
        title: "Reject relink",
        description: `Keep ${action.request.email} on its earlier sign-in. The person will still be unable to sign in with the new one.`,
        confirm: "Reject",
      };
    case "status":
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
}

export function PlatformAccountReview() {
  const { reason, isValid } = usePlatformReason();
  const [requests, setRequests] = useState<RelinkRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lookupEmail, setLookupEmail] = useState("");
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!reason) return;
    try {
      const response = await platformApi.get<{ data: RelinkRequest[] }>(
        "/api/v1/platform/accounts/relink-requests",
        reason,
      );
      setRequests(response.data);
      setLoadError(null);
    } catch (error) {
      setLoadError(describeError(error, "Failed to load relink requests."));
    }
  }, [reason]);

  useEffect(() => {
    if (isValid) void loadRequests();
  }, [isValid, loadRequests]);

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
      if (pending.kind === "status") {
        const response = await platformApi.post<{ data: Account }>(
          `/api/v1/platform/accounts/${pending.account.id}/status`,
          { status: pending.status, reason: actionReason },
          reason,
          "platform-account-status",
        );
        setAccount(response.data);
      } else {
        await platformApi.post(
          `/api/v1/platform/accounts/relink-requests/${pending.request.id}/${pending.kind}`,
          { reason: actionReason },
          reason,
          `platform-relink-${pending.kind}`,
        );
      }
      setPending(null);
      setActionReason("");
      await loadRequests();
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
            Sign-ins never take over an earlier account automatically. Review each request against a
            support ticket before approving it.
          </p>
        </header>

        {actionError ? (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        ) : null}

        <section aria-labelledby="relink-heading" className="space-y-3">
          <h2 id="relink-heading" className="text-lg font-semibold">
            Pending relink requests
          </h2>
          {loadError ? (
            <p role="alert" className="text-sm text-destructive">
              {loadError}
            </p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sign-ins are waiting for review.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Account</th>
                    <th className="py-2 pr-4 font-medium">Memberships</th>
                    <th className="py-2 pr-4 font-medium">Attempts</th>
                    <th className="py-2 pr-4 font-medium">Last attempt</th>
                    <th className="py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-b border-border align-top">
                      <td className="py-2 pr-4">
                        {request.email}
                        {request.platformRole ? (
                          <div className="text-xs text-destructive">
                            Holds platform role: {request.platformRole}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4">{STATUS_LABEL[request.accountStatus]}</td>
                      <td className="py-2 pr-4 tabular-nums">{request.activeMembershipCount}</td>
                      <td className="py-2 pr-4 tabular-nums">{request.attemptCount}</td>
                      <td className="py-2 pr-4">{formatDate(request.lastSeenAt)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => {
                              setPending({ kind: "approve", request });
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="rounded border border-border px-3 py-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => {
                              setPending({ kind: "reject", request });
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
              <dt className="text-muted-foreground">Pending relinks</dt>
              <dd className="tabular-nums">{account.pendingRelinkRequestCount}</dd>
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
                        kind: "status",
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
