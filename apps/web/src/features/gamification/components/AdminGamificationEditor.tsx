"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type AdminGamificationEditorProps = {
  members: Array<{ id: string; label: string }>;
};

export function AdminGamificationEditor({ members }: AdminGamificationEditorProps) {
  const [badgeKey, setBadgeKey] = useState("first-practice");
  const [badgeName, setBadgeName] = useState("First Practice");
  const [leaderboardKey, setLeaderboardKey] = useState("tenant-xp");
  const [leaderboardName, setLeaderboardName] = useState("Tenant XP");
  const [manualBadgeId, setManualBadgeId] = useState("");
  const [manualMembershipId, setManualMembershipId] = useState(members[0]?.id ?? "");
  const [manualReason, setManualReason] = useState("");
  const [confirmAward, setConfirmAward] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  async function createBadge() {
    setMessage(null);
    setRequestId(null);

    try {
      await clientApi.post(
        "/api/v1/badges",
        {
          operation: "create",
          badge: {
            key: badgeKey,
            name: badgeName,
            criteria: { type: "xp_total", minXp: 10 },
            status: "ACTIVE",
          },
        },
        "badge-create",
      );
      setMessage("Badge created.");
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setMessage(caught.message);
        setRequestId(caught.requestId);
      }
    }
  }

  async function createLeaderboard() {
    setMessage(null);
    setRequestId(null);

    try {
      await clientApi.post(
        "/api/v1/leaderboards",
        {
          operation: "create",
          leaderboard: {
            key: leaderboardKey,
            name: leaderboardName,
            metricKey: "xp_total",
            windowKey: "all_time",
            config: {
              scopeType: "tenant",
              privacyMode: "anonymous_rank",
              maxEntries: 10,
            },
            status: "ACTIVE",
          },
        },
        "leaderboard-create",
      );
      setMessage("Leaderboard created.");
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setMessage(caught.message);
        setRequestId(caught.requestId);
      }
    }
  }

  async function manualAward() {
    if (!confirmAward) {
      setConfirmAward(true);
      return;
    }

    setMessage(null);
    setRequestId(null);

    try {
      await clientApi.post(
        "/api/v1/badges",
        {
          operation: "manual_award",
          badgeId: manualBadgeId,
          membershipId: manualMembershipId,
          reason: manualReason,
        },
        "badge-manual-award",
      );
      setMessage("Manual badge award recorded.");
      setConfirmAward(false);
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setMessage(caught.message);
        setRequestId(caught.requestId);
      }
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Create badge</h2>
        <label className="block text-sm">
          Key
          <input
            className="mt-1 block w-full rounded border px-2 py-1"
            value={badgeKey}
            onChange={(e) => {
              setBadgeKey(e.target.value);
            }}
          />
        </label>
        <label className="block text-sm">
          Name
          <input
            className="mt-1 block w-full rounded border px-2 py-1"
            value={badgeName}
            onChange={(e) => {
              setBadgeName(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => {
            void createBadge();
          }}
        >
          Create badge
        </button>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Create leaderboard</h2>
        <label className="block text-sm">
          Key
          <input
            className="mt-1 block w-full rounded border px-2 py-1"
            value={leaderboardKey}
            onChange={(e) => {
              setLeaderboardKey(e.target.value);
            }}
          />
        </label>
        <label className="block text-sm">
          Name
          <input
            className="mt-1 block w-full rounded border px-2 py-1"
            value={leaderboardName}
            onChange={(e) => {
              setLeaderboardName(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => {
            void createLeaderboard();
          }}
        >
          Create leaderboard
        </button>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Manual badge award</h2>
        <label className="block text-sm">
          Badge ID
          <input
            className="mt-1 block w-full rounded border px-2 py-1"
            value={manualBadgeId}
            onChange={(e) => {
              setManualBadgeId(e.target.value);
            }}
          />
        </label>
        <label className="block text-sm">
          Membership
          <select
            className="mt-1 block w-full rounded border px-2 py-1"
            value={manualMembershipId}
            onChange={(e) => {
              setManualMembershipId(e.target.value);
            }}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Reason
          <input
            className="mt-1 block w-full rounded border px-2 py-1"
            value={manualReason}
            onChange={(e) => {
              setManualReason(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => {
            void manualAward();
          }}
        >
          {confirmAward ? "Confirm manual award" : "Review manual award"}
        </button>
      </section>

      {message ? (
        <p className="text-sm" role="status">
          {message}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}
    </div>
  );
}
