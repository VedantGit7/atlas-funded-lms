"use client";

import { useMemo, useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { GamificationSelectField } from "./GamificationSelectField";

type LeaderboardTableProps = {
  leaderboards: Array<{
    id: string;
    name: string;
    windowKey: string;
  }>;
  initialLeaderboardId: string | null;
  initialDetail: {
    periodKey: string;
    calculatedAt: string;
    entries: Array<{
      rank: number;
      label: string;
      metricValue: number;
      isSelf: boolean;
    }>;
    callerRank: number | null;
    callerMetricValue: number | null;
  } | null;
};

const LEAGUE_OPTIONS = [
  { value: "", label: "All leagues" },
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
] as const;

type LeagueFilter = (typeof LEAGUE_OPTIONS)[number]["value"];

const WINDOW_LABELS: Record<string, string> = {
  all_time: "All time",
  weekly: "This week",
  monthly: "This month",
};

export function windowLabel(windowKey: string): string {
  return WINDOW_LABELS[windowKey] ?? windowKey;
}

export function LeaderboardTable({
  leaderboards,
  initialLeaderboardId,
  initialDetail,
}: LeaderboardTableProps) {
  const [selectedId, setSelectedId] = useState(initialLeaderboardId);
  const [leagueFilter, setLeagueFilter] = useState<LeagueFilter>("");
  const [detail, setDetail] = useState(initialDetail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const selected = useMemo(
    () => leaderboards.find((entry) => entry.id === selectedId) ?? null,
    [leaderboards, selectedId],
  );

  async function loadLeaderboard(id: string, league?: LeagueFilter) {
    const activeLeague = league ?? leagueFilter;
    setSelectedId(id);
    setLoading(true);
    setError(null);
    setRequestId(null);

    try {
      const params = new URLSearchParams();
      if (activeLeague) params.set("league", activeLeague);
      const query = params.toString();
      const response = await clientApi.get<{
        data: NonNullable<LeaderboardTableProps["initialDetail"]> & {
          leaderboard: { name: string; windowKey: string };
        };
      }>(`/api/v1/leaderboards/${id}${query ? `?${query}` : ""}`);

      setDetail({
        periodKey: response.data.periodKey,
        calculatedAt: response.data.calculatedAt,
        entries: response.data.entries,
        callerRank: response.data.callerRank,
        callerMetricValue: response.data.callerMetricValue,
      });
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setError(caught.message);
        setRequestId(caught.requestId);
      } else {
        setError("Failed to load leaderboard.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <GamificationSelectField
        label="Leaderboard"
        value={selectedId ?? ""}
        onChange={(value) => {
          void loadLeaderboard(value, leagueFilter);
        }}
        options={leaderboards.map((leaderboard) => ({
          value: leaderboard.id,
          label: leaderboard.name,
        }))}
      />

      {selected?.windowKey === "weekly" ? (
        <GamificationSelectField
          className="sm:max-w-xs"
          label="League"
          value={leagueFilter}
          onChange={(value) => {
            const nextLeague = value as LeagueFilter;
            setLeagueFilter(nextLeague);
            if (selectedId) {
              void loadLeaderboard(selectedId, nextLeague);
            }
          }}
          options={LEAGUE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      ) : null}

      {selected ? (
        <p className="text-sm opacity-80">
          {windowLabel(selected.windowKey)}
          {detail && selected.windowKey !== "all_time" ? ` · Period: ${detail.periodKey}` : null}
        </p>
      ) : null}

      {loading ? <p className="text-sm">Loading leaderboard…</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}

      {detail ? (
        <>
          <p className="text-sm opacity-80">
            Snapshot updated: {new Date(detail.calculatedAt).toLocaleString()}
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">Rank</th>
                <th className="py-2 pr-3">Learner</th>
                <th className="py-2">XP</th>
              </tr>
            </thead>
            <tbody>
              {detail.entries.map((entry) => (
                <tr key={entry.rank} className={entry.isSelf ? "font-semibold" : undefined}>
                  <td className="py-2 pr-3">{entry.rank}</td>
                  <td className="py-2 pr-3">{entry.label}</td>
                  <td className="py-2">{entry.metricValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {detail.callerRank != null ? (
            <p className="text-sm">Your rank: {detail.callerRank}</p>
          ) : (
            <p className="text-sm opacity-80">You are not ranked on this leaderboard yet.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
