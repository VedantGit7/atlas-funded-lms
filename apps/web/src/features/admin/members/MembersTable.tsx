"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

export type MemberRow = {
  id: string;
  status: string;
  invitedEmail?: string | null | undefined;
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
};

type MembersTableProps = {
  members: MemberRow[];
};

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.message;
  }
  return "Request failed.";
}

export function MembersTable({ members }: MembersTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function suspendMember(memberId: string) {
    if (!window.confirm("Suspend this member?")) return;

    setBusyId(memberId);
    setErrorMessage(null);

    try {
      await clientApi.post(`/api/v1/members/${memberId}/suspend`, null, "member-suspend");
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(memberId: string) {
    if (!window.confirm("Remove this member? This action cannot be undone.")) return;

    setBusyId(memberId);
    setErrorMessage(null);

    try {
      await clientApi.delete(`/api/v1/members/${memberId}`, "member-remove");
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  if (members.length === 0) {
    return <p>No members found for this tenant.</p>;
  }

  return (
    <div className="space-y-4">
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}

      <div className="hidden md:block">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const label =
                member.profile?.displayName ??
                member.invitedEmail ??
                `Member ${member.id.slice(0, 8)}`;
              const isOwnerProtected =
                member.status === "ACTIVE" && label.toLowerCase().includes("owner");

              return (
                <tr key={member.id}>
                  <td>
                    <Link href={`/admin/members/${member.id}`}>{label}</Link>
                  </td>
                  <td>{member.status}</td>
                  <td className="space-x-2">
                    <Link href={`/admin/members/${member.id}`}>Open</Link>
                    <button
                      type="button"
                      disabled={busyId === member.id || isOwnerProtected}
                      onClick={() => void suspendMember(member.id)}
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      disabled={busyId === member.id || isOwnerProtected}
                      onClick={() => void removeMember(member.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {members.map((member) => {
          const label =
            member.profile?.displayName ?? member.invitedEmail ?? `Member ${member.id.slice(0, 8)}`;

          return (
            <article key={member.id} className="rounded border p-4">
              <h3>{label}</h3>
              <p>{member.status}</p>
              <div className="flex gap-2">
                <Link href={`/admin/members/${member.id}`}>Open</Link>
                <button
                  type="button"
                  disabled={busyId === member.id}
                  onClick={() => void suspendMember(member.id)}
                >
                  Suspend
                </button>
                <button
                  type="button"
                  disabled={busyId === member.id}
                  onClick={() => void removeMember(member.id)}
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
