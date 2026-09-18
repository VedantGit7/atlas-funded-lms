"use client";

import { useMemo, useState } from "react";
import { Archive, Plus, Search, Undo2 } from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  alertInfoClassName,
  fieldClassName,
  gamificationPageDescClassName,
  gamificationPageTitleClassName,
  gamificationStatusBadgeClassName,
  labelClassName,
  outlineButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
  dropdownPanelSurfaceClassName,
  tabDescription,
  tabTitle,
  type GamificationEventOption,
  type GamificationRules,
  type GamificationTabId,
} from "../gamification-admin-shared";
import {
  BadgeCriteriaEditor,
  badgeIconByKey,
  defaultCriteriaForType,
  describeCriteria,
  GAMIFICATION_EVENT_TYPES,
  type BadgeCriteria,
} from "./BadgeCriteriaEditor";
import { PointsXpRulesPanel } from "./PointsXpRulesPanel";
import { StreaksRulesPanel } from "./StreaksRulesPanel";
import { QuestsAdminPanel, type AdminQuest } from "./QuestsAdminPanel";
import { RewardsShopPanel, type RewardCurrency, type RewardItem } from "./RewardsShopPanel";
import { SeasonalEventsPanel, type SeasonalEventDto } from "./SeasonalEventsPanel";
import { GamificationOverviewPanel, type GamificationMetrics } from "./GamificationOverviewPanel";
import { GamificationTabRail } from "./GamificationTabRail";
import { GamificationAnimatedCollapsible } from "./GamificationAnimatedCollapsible";
import { GamificationSelectField } from "./GamificationSelectField";
import { MemberMultiSearchSelect } from "./MemberMultiSearchSelect";
import {
  LeaderboardConfigForm,
  type CourseOption,
  type LeaderboardDefinition,
} from "./LeaderboardConfigForm";

type BadgeDefinition = {
  id: string;
  key: string;
  name: string;
  iconKey: string | null;
  criteria: BadgeCriteria;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
};

type MemberOption = { id: string; label: string };

type AwardHistoryItem = {
  badgeId: string;
  badgeKey: string;
  badgeName: string;
  membershipId: string;
  memberLabel: string;
  awardedAt: string;
  manual: boolean;
};

type AdminGamificationEditorProps = {
  members: MemberOption[];
  initialLeaderboards?: LeaderboardDefinition[];
  initialBadges?: BadgeDefinition[];
  courses?: CourseOption[];
  metrics?: GamificationMetrics | null;
  initialRules?: GamificationRules | null;
  gamificationEvents?: GamificationEventOption[] | null;
  initialQuests?: AdminQuest[];
  initialRewardCurrencies?: RewardCurrency[];
  initialRewardItems?: RewardItem[];
  initialSeasonalEvents?: SeasonalEventDto[];
};

const BADGE_FILTERS = ["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
type BadgeFilter = (typeof BADGE_FILTERS)[number];

function FeedbackBanner({
  message,
  requestId,
}: {
  message: string | null;
  requestId: string | null;
}) {
  if (!message) return null;
  return (
    <p className={alertInfoClassName} role="status">
      {message}
      {requestId ? ` (Request ID: ${requestId})` : null}
    </p>
  );
}

function ComingSoonPanel({ tab }: { tab: GamificationTabId }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--admin-on-surface)]">{tabTitle(tab)}</p>
      <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">{tabDescription(tab)}</p>
    </div>
  );
}

function MemberSearchSelect({
  value,
  onSelect,
  initialOptions,
}: {
  value: MemberOption | null;
  onSelect: (member: MemberOption | null) => void;
  initialOptions: MemberOption[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberOption[]>(initialOptions);
  const [searching, setSearching] = useState(false);

  async function search(term: string) {
    setQuery(term);
    if (!term.trim()) {
      setResults(initialOptions);
      return;
    }
    setSearching(true);
    try {
      const response = await clientApi.get<{
        data: {
          items: Array<{
            id: string;
            invitedEmail: string | null;
            profile: { displayName: string | null } | null;
          }>;
        };
      }>(`/api/v1/members?search=${encodeURIComponent(term.trim())}&limit=10&status=ACTIVE`);
      setResults(
        response.data.items.map((member) => ({
          id: member.id,
          label: member.profile?.displayName ?? member.invitedEmail ?? member.id,
        })),
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  if (value) {
    return (
      <div className="mt-1.5 flex items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
        <span className="text-sm text-[var(--admin-on-surface)]">{value.label}</span>
        <button
          type="button"
          className="text-xs font-semibold text-[var(--admin-primary)]"
          onClick={() => {
            onSelect(null);
            setQuery("");
            setResults(initialOptions);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1.5 space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
          aria-hidden="true"
        />
        <input
          className={`${fieldClassName} pl-9`}
          value={query}
          placeholder="Search members by name or email…"
          onChange={(e) => {
            void search(e.target.value);
          }}
        />
      </div>
      {searching ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">Searching…</p>
      ) : null}
      {results.length > 0 ? (
        <ul className={`max-h-48 overflow-y-auto ${dropdownPanelSurfaceClassName}`}>
          {results.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                onClick={() => {
                  onSelect(member);
                }}
              >
                {member.label}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          {query.trim() ? "No matching active members." : "Type to search active members."}
        </p>
      )}
    </div>
  );
}

const FALLBACK_EVENT_OPTIONS: GamificationEventOption[] = GAMIFICATION_EVENT_TYPES.map((entry) => ({
  eventType: entry.value,
  label: entry.label,
  status: "active" as const,
}));

export function AdminGamificationEditor({
  members,
  initialLeaderboards = [],
  initialBadges = [],
  courses = [],
  metrics = null,
  initialRules = null,
  gamificationEvents = null,
  initialQuests = [],
  initialRewardCurrencies = [],
  initialRewardItems = [],
  initialSeasonalEvents = [],
}: AdminGamificationEditorProps) {
  const [activeTab, setActiveTab] = useState<GamificationTabId>("overview");
  const [rules, setRules] = useState<GamificationRules | null>(initialRules);
  const eventOptions = gamificationEvents ?? FALLBACK_EVENT_OPTIONS;
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Badges
  const [badges, setBadges] = useState(initialBadges);
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>("ALL");
  const [badgeKey, setBadgeKey] = useState("");
  const [badgeName, setBadgeName] = useState("");
  const [badgeStatus, setBadgeStatus] = useState<BadgeDefinition["status"]>("ACTIVE");
  const [badgeCriteria, setBadgeCriteria] = useState<BadgeCriteria>(
    defaultCriteriaForType("xp_total"),
  );
  const [badgeIconKey, setBadgeIconKey] = useState<string | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const [editBadgeName, setEditBadgeName] = useState("");
  const [editBadgeStatus, setEditBadgeStatus] = useState<BadgeDefinition["status"]>("ACTIVE");
  const [editBadgeCriteria, setEditBadgeCriteria] = useState<BadgeCriteria>(
    defaultCriteriaForType("xp_total"),
  );
  const [editBadgeIconKey, setEditBadgeIconKey] = useState<string | null>(null);
  const [archiveBadgeTarget, setArchiveBadgeTarget] = useState<BadgeDefinition | null>(null);

  // Leaderboards
  const [leaderboards, setLeaderboards] = useState(initialLeaderboards);
  const [selectedLeaderboardId, setSelectedLeaderboardId] = useState<string | null>(null);

  // Manual awards
  const [manualBadgeId, setManualBadgeId] = useState(initialBadges[0]?.id ?? "");
  const [manualMember, setManualMember] = useState<MemberOption | null>(null);
  const [manualReason, setManualReason] = useState("");
  const [bulkBadgeId, setBulkBadgeId] = useState(initialBadges[0]?.id ?? "");
  const [bulkMembers, setBulkMembers] = useState<MemberOption[]>([]);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkResult, setBulkResult] = useState<{ awarded: number; skipped: number } | null>(null);
  const [confirmAwardOpen, setConfirmAwardOpen] = useState(false);
  const [confirmBulkAwardOpen, setConfirmBulkAwardOpen] = useState(false);
  const [history, setHistory] = useState<AwardHistoryItem[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyBadgeFilter, setHistoryBadgeFilter] = useState("");
  const [pendingRevoke, setPendingRevoke] = useState<AwardHistoryItem | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const selectedBadge = useMemo(
    () => badges.find((badge) => badge.id === selectedBadgeId) ?? null,
    [badges, selectedBadgeId],
  );
  const selectedLeaderboard = useMemo(
    () => leaderboards.find((board) => board.id === selectedLeaderboardId) ?? null,
    [leaderboards, selectedLeaderboardId],
  );
  const filteredBadges = useMemo(
    () => (badgeFilter === "ALL" ? badges : badges.filter((badge) => badge.status === badgeFilter)),
    [badges, badgeFilter],
  );

  function clearFeedback() {
    setMessage(null);
    setRequestId(null);
  }

  function reportError(caught: unknown, fallback: string) {
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
    } else {
      setMessage(fallback);
    }
  }

  function selectBadge(badge: BadgeDefinition) {
    setSelectedBadgeId(badge.id);
    setEditBadgeName(badge.name);
    setEditBadgeStatus(badge.status);
    setEditBadgeCriteria(badge.criteria);
    setEditBadgeIconKey(badge.iconKey);
    setManualBadgeId(badge.id);
  }

  async function createBadge() {
    clearFeedback();
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: BadgeDefinition }>(
        "/api/v1/badges",
        {
          operation: "create",
          badge: {
            key: badgeKey.trim(),
            name: badgeName.trim(),
            ...(badgeIconKey ? { iconKey: badgeIconKey } : {}),
            criteria: badgeCriteria,
            status: badgeStatus,
          },
        },
        `badge-create-${badgeKey.trim()}`,
      );
      setBadges((current) => [...current, response.data]);
      setBadgeKey("");
      setBadgeName("");
      setBadgeCriteria(defaultCriteriaForType("xp_total"));
      setBadgeIconKey(null);
      setMessage("Badge created.");
    } catch (caught) {
      reportError(caught, "Failed to create badge.");
    } finally {
      setBusy(false);
    }
  }

  async function saveBadge(overrides?: { status: BadgeDefinition["status"]; id: string }) {
    const badgeId = overrides?.id ?? selectedBadgeId;
    if (!badgeId) return;
    clearFeedback();
    setBusy(true);
    try {
      const response = await clientApi.put<{ data: BadgeDefinition }>(
        "/api/v1/badges",
        overrides
          ? { id: overrides.id, status: overrides.status }
          : {
              id: badgeId,
              name: editBadgeName.trim(),
              status: editBadgeStatus,
              criteria: editBadgeCriteria,
              iconKey: editBadgeIconKey,
            },
        `badge-update-${badgeId}-${Date.now().toString()}`,
      );
      setBadges((current) =>
        current.map((badge) => (badge.id === badgeId ? response.data : badge)),
      );
      if (selectedBadgeId === badgeId) {
        selectBadge(response.data);
      }
      setMessage(overrides ? "Badge archived." : "Badge saved.");
    } catch (caught) {
      reportError(caught, "Failed to save badge.");
    } finally {
      setBusy(false);
      setArchiveBadgeTarget(null);
    }
  }

  function upsertLeaderboard(definition: LeaderboardDefinition) {
    setLeaderboards((current) => {
      const exists = current.some((board) => board.id === definition.id);
      return exists
        ? current.map((board) => (board.id === definition.id ? definition : board))
        : [...current, definition];
    });
    setSelectedLeaderboardId(definition.id);
    setMessage("Leaderboard saved.");
  }

  async function loadHistory(reset: boolean) {
    try {
      const params = new URLSearchParams();
      params.set("limit", "10");
      if (historyBadgeFilter) params.set("badgeId", historyBadgeFilter);
      if (!reset && historyCursor) params.set("cursor", historyCursor);
      const response = await clientApi.get<{
        data: { items: AwardHistoryItem[]; nextCursor: string | null };
      }>(`/api/v1/badges/awards?${params.toString()}`);
      setHistory((current) => (reset ? response.data.items : [...current, ...response.data.items]));
      setHistoryCursor(response.data.nextCursor);
      setHistoryLoaded(true);
    } catch (caught) {
      reportError(caught, "Failed to load award history.");
    }
  }

  async function manualAward() {
    if (!manualMember) return;
    clearFeedback();
    setBusy(true);
    try {
      await clientApi.post(
        "/api/v1/badges",
        {
          operation: "manual_award",
          badgeId: manualBadgeId,
          membershipId: manualMember.id,
          reason: manualReason,
        },
        "badge-manual-award",
      );
      setConfirmAwardOpen(false);
      setManualReason("");
      setMessage("Badge awarded.");
      if (historyLoaded) {
        await loadHistory(true);
      }
    } catch (caught) {
      reportError(caught, "Failed to award badge.");
    } finally {
      setBusy(false);
    }
  }

  async function manualAwardBulk() {
    if (bulkMembers.length === 0) return;
    clearFeedback();
    setBusy(true);
    try {
      const response = await clientApi.post<{
        data: { awarded: number; skipped: number };
      }>(
        "/api/v1/badges",
        {
          operation: "manual_award_bulk",
          badgeId: bulkBadgeId,
          membershipIds: bulkMembers.map((member) => member.id),
          reason: bulkReason,
        },
        "badge-manual-award-bulk",
      );
      setConfirmBulkAwardOpen(false);
      setBulkReason("");
      setBulkMembers([]);
      setBulkResult(response.data);
      setMessage(
        `Bulk award complete: ${String(response.data.awarded)} awarded, ${String(response.data.skipped)} skipped.`,
      );
      if (historyLoaded) {
        await loadHistory(true);
      }
    } catch (caught) {
      reportError(caught, "Failed to bulk award badges.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeAward() {
    if (!pendingRevoke || !revokeReason.trim()) return;
    clearFeedback();
    setBusy(true);
    try {
      await clientApi.post(
        "/api/v1/badges",
        {
          operation: "revoke_award",
          badgeId: pendingRevoke.badgeId,
          membershipId: pendingRevoke.membershipId,
          reason: revokeReason.trim(),
        },
        `badge-revoke-${pendingRevoke.badgeId}-${pendingRevoke.membershipId}`,
      );
      setPendingRevoke(null);
      setRevokeReason("");
      setMessage("Badge award revoked.");
      await loadHistory(true);
    } catch (caught) {
      reportError(caught, "Failed to revoke badge award.");
    } finally {
      setBusy(false);
    }
  }

  function renderBadgesTab() {
    return (
      <div className="space-y-6">
        <section className={panelClassName}>
          <div className={panelHeaderClassName}>
            <div>
              <p className={panelEyebrowClassName}>Create</p>
              <h2 className="font-semibold text-[var(--admin-on-surface)]">New badge</h2>
            </div>
          </div>
          <div className={`${panelBodyClassName} space-y-4`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClassName}>Key</span>
                <input
                  className={`${fieldClassName} mt-1.5`}
                  value={badgeKey}
                  placeholder="first-practice"
                  onChange={(e) => {
                    setBadgeKey(e.target.value);
                  }}
                />
              </label>
              <label className="block">
                <span className={labelClassName}>Name</span>
                <input
                  className={`${fieldClassName} mt-1.5`}
                  value={badgeName}
                  placeholder="First Practice"
                  onChange={(e) => {
                    setBadgeName(e.target.value);
                  }}
                />
              </label>
            </div>
            <BadgeCriteriaEditor
              idPrefix="badge-create"
              criteria={badgeCriteria}
              onChange={setBadgeCriteria}
              iconKey={badgeIconKey}
              onIconChange={setBadgeIconKey}
            />
            <GamificationSelectField
              className="sm:max-w-xs"
              label="Status"
              value={badgeStatus}
              onChange={(value) => {
                setBadgeStatus(value as BadgeDefinition["status"]);
              }}
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy || !badgeKey.trim() || !badgeName.trim()}
              onClick={() => {
                void createBadge();
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create badge
            </button>
          </div>
        </section>

        <section className={panelClassName}>
          <div className={panelHeaderClassName}>
            <div>
              <p className={panelEyebrowClassName}>Catalogue</p>
              <h2 className="font-semibold text-[var(--admin-on-surface)]">Badges</h2>
            </div>
            <div className="flex gap-1" role="tablist" aria-label="Badge status filter">
              {BADGE_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={
                    badgeFilter === filter
                      ? "rounded-full bg-[var(--admin-primary)] px-2.5 py-1 text-[11px] font-bold text-[var(--admin-on-primary)]"
                      : "rounded-full bg-[var(--admin-surface-high)] px-2.5 py-1 text-[11px] font-bold text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                  }
                  onClick={() => {
                    setBadgeFilter(filter);
                  }}
                >
                  {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div className={panelBodyClassName}>
            {filteredBadges.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No badges match this filter.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--admin-border)]">
                {filteredBadges.map((badge) => {
                  const Icon = badgeIconByKey(badge.iconKey);
                  return (
                    <li key={badge.id} className="flex items-center gap-3 py-2.5">
                      <div className="rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] p-2">
                        <Icon className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                          {badge.name}
                          <span className="ml-2 text-xs font-normal text-[var(--admin-on-surface-variant)]">
                            {badge.key}
                          </span>
                        </p>
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          {describeCriteria(badge.criteria)}
                        </p>
                      </div>
                      <span className={gamificationStatusBadgeClassName(badge.status)}>
                        {badge.status}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--admin-primary)]"
                        onClick={() => {
                          selectBadge(badge);
                        }}
                      >
                        Edit
                      </button>
                      {badge.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          title="Archive badge"
                          className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                          onClick={() => {
                            setArchiveBadgeTarget(badge);
                          }}
                        >
                          <Archive className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <GamificationAnimatedCollapsible open={Boolean(selectedBadge)} id="badge-edit-panel">
          {selectedBadge ? (
            <section className={panelClassName}>
              <div className={panelHeaderClassName}>
                <div>
                  <p className={panelEyebrowClassName}>Edit</p>
                  <h2 className="font-semibold text-[var(--admin-on-surface)]">
                    {selectedBadge.name}
                  </h2>
                </div>
              </div>
              <div className={`${panelBodyClassName} space-y-4`}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClassName}>Display name</span>
                    <input
                      className={`${fieldClassName} mt-1.5`}
                      value={editBadgeName}
                      onChange={(e) => {
                        setEditBadgeName(e.target.value);
                      }}
                    />
                  </label>
                  <GamificationSelectField
                    label="Status"
                    value={editBadgeStatus}
                    onChange={(value) => {
                      setEditBadgeStatus(value as BadgeDefinition["status"]);
                    }}
                    options={[
                      { value: "ACTIVE", label: "ACTIVE" },
                      { value: "INACTIVE", label: "INACTIVE" },
                      { value: "ARCHIVED", label: "ARCHIVED" },
                    ]}
                  />
                </div>
                <BadgeCriteriaEditor
                  idPrefix="badge-edit"
                  criteria={editBadgeCriteria}
                  onChange={setEditBadgeCriteria}
                  iconKey={editBadgeIconKey}
                  onIconChange={setEditBadgeIconKey}
                />
                <button
                  type="button"
                  className={outlineButtonClassName}
                  disabled={busy || !editBadgeName.trim()}
                  onClick={() => {
                    void saveBadge();
                  }}
                >
                  Save badge
                </button>
              </div>
            </section>
          ) : null}
        </GamificationAnimatedCollapsible>
      </div>
    );
  }

  function renderLeaderboardsTab() {
    return (
      <div className="space-y-6">
        <section className={panelClassName}>
          <div className={panelHeaderClassName}>
            <div>
              <p className={panelEyebrowClassName}>Create</p>
              <h2 className="font-semibold text-[var(--admin-on-surface)]">New leaderboard</h2>
            </div>
          </div>
          <div className={panelBodyClassName}>
            <LeaderboardConfigForm
              mode="create"
              definition={null}
              courses={courses}
              onSaved={upsertLeaderboard}
            />
          </div>
        </section>

        {leaderboards.length > 0 ? (
          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <div>
                <p className={panelEyebrowClassName}>Catalogue</p>
                <h2 className="font-semibold text-[var(--admin-on-surface)]">Edit leaderboard</h2>
              </div>
            </div>
            <div className={`${panelBodyClassName} space-y-4`}>
              <GamificationSelectField
                className="sm:max-w-md"
                label="Leaderboard"
                value={selectedLeaderboardId ?? ""}
                onChange={(value) => {
                  setSelectedLeaderboardId(value || null);
                }}
                placeholder="Select a leaderboard…"
                options={[
                  { value: "", label: "Select a leaderboard…" },
                  ...leaderboards.map((board) => ({
                    value: board.id,
                    label: `${board.name} (${board.key})`,
                  })),
                ]}
              />
              <GamificationAnimatedCollapsible
                open={Boolean(selectedLeaderboard)}
                id="leaderboard-edit-panel"
              >
                {selectedLeaderboard ? (
                  <LeaderboardConfigForm
                    key={selectedLeaderboard.id}
                    mode="edit"
                    definition={selectedLeaderboard}
                    courses={courses}
                    onSaved={upsertLeaderboard}
                  />
                ) : null}
              </GamificationAnimatedCollapsible>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  function renderAwardsTab() {
    return (
      <div className="space-y-6">
        <section className={panelClassName}>
          <div className={panelHeaderClassName}>
            <div>
              <p className={panelEyebrowClassName}>Manual action</p>
              <h2 className="font-semibold text-[var(--admin-on-surface)]">
                Award badge to member
              </h2>
            </div>
          </div>
          <div className={`${panelBodyClassName} space-y-4`}>
            <GamificationSelectField
              label="Badge"
              value={manualBadgeId}
              onChange={setManualBadgeId}
              disabled={badges.length === 0}
              placeholder="Create a badge first"
              options={
                badges.length === 0
                  ? [{ value: "", label: "Create a badge first" }]
                  : badges.map((badge) => ({
                      value: badge.id,
                      label: badge.name,
                    }))
              }
            />
            <div>
              <span className={labelClassName}>Member</span>
              <MemberSearchSelect
                value={manualMember}
                onSelect={setManualMember}
                initialOptions={members}
              />
            </div>
            <label className="block">
              <span className={labelClassName}>Reason</span>
              <input
                className={`${fieldClassName} mt-1.5`}
                value={manualReason}
                onChange={(e) => {
                  setManualReason(e.target.value);
                }}
                placeholder="Required audit reason"
              />
            </label>
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy || !manualBadgeId || !manualMember || !manualReason.trim()}
              onClick={() => {
                setConfirmAwardOpen(true);
              }}
            >
              Review manual award
            </button>
          </div>
        </section>

        <section className={panelClassName}>
          <div className={panelHeaderClassName}>
            <div>
              <p className={panelEyebrowClassName}>Bulk action</p>
              <h2 className="font-semibold text-[var(--admin-on-surface)]">
                Award badge to multiple members
              </h2>
            </div>
          </div>
          <div className={`${panelBodyClassName} space-y-4`}>
            <GamificationSelectField
              label="Badge"
              value={bulkBadgeId}
              onChange={setBulkBadgeId}
              disabled={badges.length === 0}
              placeholder="Create a badge first"
              options={
                badges.length === 0
                  ? [{ value: "", label: "Create a badge first" }]
                  : badges.map((badge) => ({
                      value: badge.id,
                      label: badge.name,
                    }))
              }
            />
            <div>
              <span className={labelClassName}>Members</span>
              <MemberMultiSearchSelect
                selected={bulkMembers}
                onChange={setBulkMembers}
                initialOptions={members}
              />
            </div>
            <label className="block">
              <span className={labelClassName}>Reason</span>
              <input
                className={`${fieldClassName} mt-1.5`}
                value={bulkReason}
                onChange={(e) => {
                  setBulkReason(e.target.value);
                }}
                placeholder="Required audit reason for all awards"
              />
            </label>
            {bulkResult ? (
              <p className={alertInfoClassName} role="status">
                Last bulk run: {bulkResult.awarded} awarded, {bulkResult.skipped} skipped.
              </p>
            ) : null}
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy || !bulkBadgeId || bulkMembers.length === 0 || !bulkReason.trim()}
              onClick={() => {
                setConfirmBulkAwardOpen(true);
              }}
            >
              Review bulk award ({bulkMembers.length} member
              {bulkMembers.length === 1 ? "" : "s"})
            </button>
          </div>
        </section>

        <section className={panelClassName}>
          <div className={panelHeaderClassName}>
            <div>
              <p className={panelEyebrowClassName}>History</p>
              <h2 className="font-semibold text-[var(--admin-on-surface)]">Award history</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GamificationSelectField
                className="min-w-[10rem] flex-1 sm:flex-none"
                label={<span className="sr-only">Filter by badge</span>}
                value={historyBadgeFilter}
                onChange={setHistoryBadgeFilter}
                options={[
                  { value: "", label: "All badges" },
                  ...badges.map((badge) => ({
                    value: badge.id,
                    label: badge.name,
                  })),
                ]}
              />
              <button
                type="button"
                className={outlineButtonClassName}
                disabled={busy}
                onClick={() => {
                  void loadHistory(true);
                }}
              >
                {historyLoaded ? "Refresh" : "Load history"}
              </button>
            </div>
          </div>
          <div className={panelBodyClassName}>
            {!historyLoaded ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Load the history to review and revoke awards.
              </p>
            ) : history.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">No awards found.</p>
            ) : (
              <div className="space-y-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] text-left text-[var(--admin-on-surface-variant)]">
                      <th className="py-2 pr-3 font-medium">Badge</th>
                      <th className="py-2 pr-3 font-medium">Member</th>
                      <th className="py-2 pr-3 font-medium">Awarded</th>
                      <th className="py-2 pr-3 font-medium">Source</th>
                      <th className="py-2 font-medium" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr
                        key={`${item.badgeId}-${item.membershipId}`}
                        className="border-b border-[var(--admin-border)] last:border-b-0"
                      >
                        <td className="py-2 pr-3">{item.badgeName}</td>
                        <td className="py-2 pr-3">{item.memberLabel}</td>
                        <td className="py-2 pr-3">{new Date(item.awardedAt).toLocaleString()}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={gamificationStatusBadgeClassName(
                              item.manual ? "INACTIVE" : "ACTIVE",
                            )}
                          >
                            {item.manual ? "MANUAL" : "AUTO"}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-danger)]"
                            onClick={() => {
                              setPendingRevoke(item);
                              setRevokeReason("");
                            }}
                          >
                            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {historyCursor ? (
                  <button
                    type="button"
                    className={outlineButtonClassName}
                    disabled={busy}
                    onClick={() => {
                      void loadHistory(false);
                    }}
                  >
                    Load more
                  </button>
                ) : null}
              </div>
            )}

            {pendingRevoke ? (
              <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_6%,var(--admin-surface))] p-4">
                <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                  Revoke “{pendingRevoke.badgeName}” from {pendingRevoke.memberLabel}?
                </p>
                <label className="mt-3 block">
                  <span className={labelClassName}>Audit reason</span>
                  <input
                    className={`${fieldClassName} mt-1.5`}
                    value={revokeReason}
                    onChange={(e) => {
                      setRevokeReason(e.target.value);
                    }}
                    placeholder="Why is this award being revoked?"
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    disabled={busy || !revokeReason.trim()}
                    onClick={() => {
                      void revokeAward();
                    }}
                  >
                    Confirm revoke
                  </button>
                  <button
                    type="button"
                    className={outlineButtonClassName}
                    disabled={busy}
                    onClick={() => {
                      setPendingRevoke(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "overview":
        return (
          <GamificationOverviewPanel
            summary={{ badges, leaderboards }}
            metrics={metrics}
            onNavigate={setActiveTab}
            members={members}
            eventOptions={eventOptions}
            leaderboards={leaderboards.map((board) => ({ key: board.key, name: board.name }))}
          />
        );
      case "badges":
        return renderBadgesTab();
      case "leaderboards":
        return renderLeaderboardsTab();
      case "awards":
        return renderAwardsTab();
      case "points":
        return rules ? (
          <PointsXpRulesPanel rules={rules} events={eventOptions} onSaved={setRules} />
        ) : (
          <ComingSoonPanel tab={activeTab} />
        );
      case "streaks":
        return rules ? (
          <StreaksRulesPanel rules={rules} events={eventOptions} onSaved={setRules} />
        ) : (
          <ComingSoonPanel tab={activeTab} />
        );
      case "quests":
        return (
          <QuestsAdminPanel
            initialQuests={initialQuests}
            badges={badges.map((badge) => ({ key: badge.key, name: badge.name }))}
            courses={courses}
            events={eventOptions}
          />
        );
      case "shop":
        return (
          <RewardsShopPanel
            initialCurrencies={initialRewardCurrencies}
            initialItems={initialRewardItems}
            members={members}
            courses={courses}
          />
        );
      case "seasonal":
        return (
          <SeasonalEventsPanel
            initialEvents={initialSeasonalEvents}
            quests={initialQuests.map((quest) => ({ id: quest.id, name: quest.name }))}
            leaderboards={leaderboards.map((board) => ({ key: board.key, name: board.name }))}
          />
        );
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className={gamificationPageTitleClassName}>{tabTitle(activeTab)}</h1>
        <p className={gamificationPageDescClassName}>{tabDescription(activeTab)}</p>
      </header>

      {message ? <FeedbackBanner message={message} requestId={requestId} /> : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <GamificationTabRail activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="min-w-0 flex-1">{renderTabContent()}</div>
      </div>

      <AdminConfirmDialog
        open={confirmAwardOpen}
        title="Confirm manual badge award"
        description="Award this badge to the selected member? The reason will be recorded in the audit trail."
        confirmLabel="Confirm award"
        busyLabel="Awarding…"
        busy={busy}
        onConfirm={() => {
          void manualAward();
        }}
        onCancel={() => {
          if (!busy) setConfirmAwardOpen(false);
        }}
      />

      <AdminConfirmDialog
        open={confirmBulkAwardOpen}
        title="Confirm bulk badge award"
        description={`Award this badge to ${String(bulkMembers.length)} member(s)? Members who already have the badge will be skipped.`}
        confirmLabel="Confirm bulk award"
        busyLabel="Awarding…"
        busy={busy}
        onConfirm={() => {
          void manualAwardBulk();
        }}
        onCancel={() => {
          if (!busy) setConfirmBulkAwardOpen(false);
        }}
      />

      <AdminConfirmDialog
        open={archiveBadgeTarget != null}
        title="Archive badge"
        description={`Archive “${archiveBadgeTarget?.name ?? ""}”? Learners keep earned awards, but the badge can no longer be earned or awarded.`}
        confirmLabel="Archive badge"
        busyLabel="Archiving…"
        busy={busy}
        onConfirm={() => {
          if (archiveBadgeTarget) {
            void saveBadge({ id: archiveBadgeTarget.id, status: "ARCHIVED" });
          }
        }}
        onCancel={() => {
          if (!busy) setArchiveBadgeTarget(null);
        }}
      />
    </div>
  );
}
