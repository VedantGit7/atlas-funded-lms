"use client";

import { useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  alertErrorClassName,
  alertInfoClassName,
  iconButtonClassName,
  inlineExpandClassName,
  outlineButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
  type GamificationEventOption,
} from "../gamification-admin-shared";
import { GamificationSelectField } from "./GamificationSelectField";

type MemberOption = { id: string; label: string };

type SimulateResult = {
  eventType: string;
  seasonalMultiplier: number;
  xp: {
    total: number;
    entries: Array<{ ruleKey: string; points: number }>;
  };
  streaks: Array<{
    streakKey: string;
    wouldAdvance: boolean;
    projectedCount: number;
    bonusXp: number;
  }>;
  badges: Array<{ key: string; name: string }>;
  quests: Array<{
    key: string;
    name: string;
    stepsProgressed: number;
    wouldComplete: boolean;
  }>;
};

type GamificationSimulatePanelProps = {
  members: MemberOption[];
  events: GamificationEventOption[];
};

export function GamificationSimulatePanel({ members, events }: GamificationSimulatePanelProps) {
  const [open, setOpen] = useState(false);
  const [membershipId, setMembershipId] = useState(members[0]?.id ?? "");
  const [eventType, setEventType] = useState(
    events.find((e) => e.status === "active")?.eventType ?? "",
  );
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeEvents = events.filter((event) => event.status === "active");

  async function runSimulation() {
    if (!membershipId || !eventType) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    setRequestId(null);
    setResult(null);

    try {
      const response = await clientApi.post<{ data: SimulateResult }>(
        "/api/v1/gamification/simulate",
        { membershipId, eventType },
        `gamification-simulate-${Date.now().toString()}`,
      );
      setResult(response.data);
      setMessage("Dry-run complete — no data was written.");
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setError(caught.message);
        setRequestId(caught.requestId);
      } else {
        setError("Simulation failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-lg transition-transform hover:scale-105"
        title="Simulate gamification event"
        aria-label="Simulate gamification event"
        onClick={() => {
          setOpen(true);
        }}
      >
        <FlaskConical className="h-6 w-6" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 motion-safe:animate-[admin-fade-in_0.2s_ease-out] sm:items-center">
          <section
            className={`${panelClassName} max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-xl ${inlineExpandClassName}`}
            role="dialog"
            aria-labelledby="simulate-panel-title"
          >
            <div className={panelHeaderClassName}>
              <div>
                <p className={panelEyebrowClassName}>Dry run</p>
                <h2
                  id="simulate-panel-title"
                  className="font-semibold text-[var(--admin-on-surface)]"
                >
                  Simulate engine
                </h2>
              </div>
              <button
                type="button"
                className={iconButtonClassName}
                aria-label="Close simulate panel"
                onClick={() => {
                  setOpen(false);
                }}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className={`${panelBodyClassName} space-y-4`}>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Preview XP, streaks, badges, and quest progress for a member without writing to the
                database.
              </p>

              {message ? (
                <p className={alertInfoClassName} role="status">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className={alertErrorClassName} role="alert">
                  {error}
                  {requestId ? ` (Request ID: ${requestId})` : null}
                </p>
              ) : null}

              <GamificationSelectField
                label="Member"
                value={membershipId}
                onChange={setMembershipId}
                disabled={members.length === 0}
                placeholder="No members available"
                options={members.map((member) => ({
                  value: member.id,
                  label: member.label,
                }))}
              />

              <GamificationSelectField
                label="Event type"
                value={eventType}
                onChange={setEventType}
                options={activeEvents.map((event) => ({
                  value: event.eventType,
                  label: event.label,
                }))}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={busy || !membershipId || !eventType}
                  onClick={() => {
                    void runSimulation();
                  }}
                >
                  {busy ? "Simulating…" : "Run simulation"}
                </button>
                <button
                  type="button"
                  className={outlineButtonClassName}
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  Close
                </button>
              </div>

              {result ? (
                <div
                  className={`space-y-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 ${inlineExpandClassName}`}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">XP</h3>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                      +{result.xp.total} XP
                      {result.seasonalMultiplier !== 1
                        ? ` (${String(result.seasonalMultiplier)}× seasonal multiplier)`
                        : null}
                    </p>
                    {result.xp.entries.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-[var(--admin-on-surface-variant)]">
                        {result.xp.entries.map((entry) => (
                          <li key={entry.ruleKey}>
                            {entry.ruleKey}: +{entry.points}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Streaks
                    </h3>
                    {result.streaks.length === 0 ? (
                      <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                        No streak changes.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-[var(--admin-on-surface-variant)]">
                        {result.streaks.map((streak) => (
                          <li key={streak.streakKey}>
                            {streak.streakKey}:{" "}
                            {streak.wouldAdvance
                              ? `→ ${String(streak.projectedCount)} days`
                              : "no change"}
                            {streak.bonusXp > 0 ? ` (+${String(streak.bonusXp)} bonus XP)` : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Badges</h3>
                    {result.badges.length === 0 ? (
                      <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                        No new badges would unlock.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-[var(--admin-on-surface-variant)]">
                        {result.badges.map((badge) => (
                          <li key={badge.key}>
                            {badge.name} ({badge.key})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Quests</h3>
                    {result.quests.length === 0 ? (
                      <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                        No quest progress changes.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-[var(--admin-on-surface-variant)]">
                        {result.quests.map((quest) => (
                          <li key={quest.key}>
                            {quest.name}: +{String(quest.stepsProgressed)} step(s)
                            {quest.wouldComplete ? " — would complete" : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
