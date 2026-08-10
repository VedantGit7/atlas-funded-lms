import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  zoomMatchingRulesBodySchema,
  zoomMatchingRulesResponseSchema,
  zoomUnmatchedBulkMatchResponseSchema,
  zoomUnmatchedListResponseSchema,
  type ZoomMatchingRulesBody,
  type ZoomUnmatchedBulkMatchBody,
  type ZoomUnmatchedListQuery,
} from "./zoom-insights-roster.dto";
import { zoomParticipantMatchInvalid } from "./zoom-insights-roster.errors";
import { zoomInsightsRosterRepository } from "./zoom-insights-roster.repository";
import { mutateZoomMeetingParticipantMatch } from "./zoom-insights-roster.service";
import {
  zoomInsightsUnmatchedRepository,
  type ZoomMatchingRulesStored,
  type ZoomMembershipCandidateRow,
  type ZoomUnmatchedIdentityRow,
} from "./zoom-insights-unmatched.repository";

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function mapConnection(
  connection: Awaited<ReturnType<typeof zoomInsightsRosterRepository.getConnectionMeta>>,
) {
  return {
    status: connection.status,
    connectedAt: connection.connected_at?.toISOString() ?? null,
    lastSyncedAt: connection.last_synced_at?.toISOString() ?? null,
    meetingsImportedToday: connection.meetings_imported_today,
    hasConnectionRecord: connection.has_connection_record,
  };
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function extractEmail(row: ZoomUnmatchedIdentityRow): string | null {
  if (row.email) return row.email.toLowerCase();
  const fromName = row.display_name?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return fromName?.[0]?.toLowerCase() ?? null;
}

function isLikelyGuest(
  row: ZoomUnmatchedIdentityRow,
  rules: ZoomMatchingRulesStored,
  email: string | null,
): boolean {
  const name = (row.display_name ?? "").toLowerCase();
  if (name.startsWith("guest")) return true;
  if (/\b(room|device|iphone|ipad|android|polycom|zoom room)\b/i.test(name)) return true;
  if (email) {
    const domain = email.split("@")[1] ?? "";
    if (rules.guestEmailDomains.includes(domain)) return true;
  }
  return false;
}

type Suggestion = {
  membershipId: string;
  displayName: string | null;
  email: string | null;
  confidence: "high" | "medium" | "low";
  reason: "exact_email" | "normalized_display_name" | "domain_plus_enrollment";
  reasonLabel: string;
};

function buildSuggestions(
  row: ZoomUnmatchedIdentityRow,
  rules: ZoomMatchingRulesStored,
  candidates: ZoomMembershipCandidateRow[],
): Suggestion[] {
  const email = extractEmail(row);
  const nameKey = normalizeName(row.display_name);
  const suggestions: Suggestion[] = [];

  if (rules.matchOnExactEmail && email) {
    for (const candidate of candidates) {
      if (candidate.email_normalized === email) {
        suggestions.push({
          membershipId: candidate.membership_id,
          displayName: candidate.display_name,
          email: candidate.email,
          confidence: "high",
          reason: "exact_email",
          reasonLabel: "Zoom email matches learner email exactly.",
        });
      }
    }
  }

  if (rules.matchOnNormalizedDisplayName && nameKey.length >= 3) {
    for (const candidate of candidates) {
      if (candidate.name_normalized === nameKey) {
        if (suggestions.some((item) => item.membershipId === candidate.membership_id)) continue;
        suggestions.push({
          membershipId: candidate.membership_id,
          displayName: candidate.display_name,
          email: candidate.email,
          confidence: "medium",
          reason: "normalized_display_name",
          reasonLabel: "Display name matches a learner after normalisation.",
        });
      }
    }
  }

  if (rules.matchOnEmailDomainPlusEnrollment && email) {
    const domain = email.split("@")[1] ?? "";
    if (domain && !rules.guestEmailDomains.includes(domain)) {
      for (const candidate of candidates) {
        const candidateDomain = (candidate.email_normalized ?? "").split("@")[1] ?? "";
        if (!candidateDomain || candidateDomain !== domain) continue;
        if (suggestions.some((item) => item.membershipId === candidate.membership_id)) continue;
        suggestions.push({
          membershipId: candidate.membership_id,
          displayName: candidate.display_name,
          email: candidate.email,
          confidence: "low",
          reason: "domain_plus_enrollment",
          reasonLabel: "Same email domain as an enrolled learner.",
        });
      }
    }
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return suggestions.sort((a, b) => rank[a.confidence] - rank[b.confidence]).slice(0, 5);
}

function classifyGroup(
  row: ZoomUnmatchedIdentityRow,
  rules: ZoomMatchingRulesStored,
  suggestions: Suggestion[],
): "high" | "medium" | "guest" | "none" {
  const email = extractEmail(row);
  if (isLikelyGuest(row, rules, email) && suggestions.every((item) => item.confidence !== "high")) {
    return "guest";
  }
  if (suggestions.some((item) => item.confidence === "high")) return "high";
  if (suggestions.some((item) => item.confidence === "medium" || item.confidence === "low")) {
    return "medium";
  }
  return "none";
}

function toIdentityDto(
  row: ZoomUnmatchedIdentityRow,
  group: "high" | "medium" | "guest" | "none",
  suggestions: Suggestion[],
) {
  return {
    identityKey: row.identity_key,
    displayName: row.display_name,
    email: extractEmail(row),
    externalUserId: row.external_user_id,
    meetingsAttended: row.meetings_attended,
    totalDurationSeconds: row.total_duration_seconds,
    firstSeenAt: row.first_seen_at?.toISOString() ?? null,
    lastSeenAt: row.last_seen_at?.toISOString() ?? null,
    representativeMeetingId: row.representative_meeting_id,
    representativeParticipantId: row.representative_participant_id,
    otherUnmatchedMeetingCount: row.other_unmatched_meeting_count,
    group,
    suggestions,
  };
}

export async function listZoomUnmatchedIdentities(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ZoomUnmatchedListQuery,
) {
  const rules = await zoomInsightsUnmatchedRepository.getMatchingRules(tx);
  const listQuery = { ...query, group: "all" as const };
  const [totalCount, rows, connection, scope, reconciledLast30Days] = await Promise.all([
    zoomInsightsUnmatchedRepository.countUnmatchedIdentities(tx, listQuery),
    zoomInsightsUnmatchedRepository.listUnmatchedIdentities(tx, listQuery),
    zoomInsightsRosterRepository.getConnectionMeta(tx),
    zoomInsightsUnmatchedRepository.summarizeUnmatchedScope(
      tx,
      query.attendedFrom,
      query.attendedTo,
    ),
    zoomInsightsUnmatchedRepository.countReconciledLast30Days(tx),
  ]);

  const summaryLimit = Math.min(Math.max(totalCount, 1), 500);
  const needsSummaryFetch = query.page !== 1 || totalCount > listQuery.limit;
  const summaryRows = needsSummaryFetch
    ? await zoomInsightsUnmatchedRepository.listUnmatchedIdentities(tx, {
        ...listQuery,
        page: 1,
        limit: summaryLimit,
      })
    : rows;

  const candidateSource = summaryRows.length >= rows.length ? summaryRows : rows;
  const emails = Array.from(
    new Set(
      candidateSource
        .map((row) => extractEmail(row))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const names = Array.from(
    new Set(
      candidateSource
        .map((row) => normalizeName(row.display_name))
        .filter((value) => value.length >= 3),
    ),
  );
  const candidates = await zoomInsightsUnmatchedRepository.findMembershipCandidates(tx, {
    emails,
    names,
  });

  const enriched = rows.map((row) => {
    const suggestions = buildSuggestions(row, rules, candidates);
    const group = classifyGroup(row, rules, suggestions);
    return toIdentityDto(row, group, suggestions);
  });

  const summaryEnriched =
    summaryRows === rows
      ? enriched
      : summaryRows.map((row) => {
          const suggestions = buildSuggestions(row, rules, candidates);
          const group = classifyGroup(row, rules, suggestions);
          return toIdentityDto(row, group, suggestions);
        });

  const filtered =
    query.group === "all" ? enriched : enriched.filter((item) => item.group === query.group);

  const groups = {
    high: enriched.filter((item) => item.group === "high"),
    medium: enriched.filter((item) => item.group === "medium"),
    guest: enriched.filter((item) => item.group === "guest"),
    none: enriched.filter((item) => item.group === "none"),
  };

  const summaryGroups = {
    high: summaryEnriched.filter((item) => item.group === "high").length,
    medium: summaryEnriched.filter((item) => item.group === "medium").length,
    guest: summaryEnriched.filter((item) => item.group === "guest").length,
    none: summaryEnriched.filter((item) => item.group === "none").length,
  };

  return zoomUnmatchedListResponseSchema.parse({
    data: {
      items: filtered,
      groups,
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      connectionStatus: connection.status,
      connection: mapConnection(connection),
      summary: {
        unmatchedIdentities: totalCount,
        meetingCount: scope.meeting_count,
        joinRecordCount: scope.join_record_count,
        highConfidence: summaryGroups.high,
        needsReview: summaryGroups.medium + summaryGroups.none,
        likelyGuests: summaryGroups.guest,
        attendanceNotCountedSeconds: scope.attendance_not_counted_seconds,
        reconciledLast30Days,
      },
    },
  });
}

export async function getZoomMatchingRules(tx: TenantTx, _ctx: ServiceCtx) {
  void _ctx;
  const rules = await zoomInsightsUnmatchedRepository.getMatchingRules(tx);
  return zoomMatchingRulesResponseSchema.parse({ data: rules });
}

export async function updateZoomMatchingRules(
  tx: TenantTx,
  _ctx: ServiceCtx,
  body: ZoomMatchingRulesBody,
) {
  const parsed = zoomMatchingRulesBodySchema.parse(body);
  await zoomInsightsUnmatchedRepository.saveMatchingRules(tx, parsed);
  return zoomMatchingRulesResponseSchema.parse({
    data: {
      matchOnExactEmail: parsed.matchOnExactEmail,
      matchOnNormalizedDisplayName: parsed.matchOnNormalizedDisplayName,
      matchOnEmailDomainPlusEnrollment: parsed.matchOnEmailDomainPlusEnrollment,
      autoMatchHighConfidenceOnImport: parsed.autoMatchHighConfidenceOnImport,
      guestEmailDomains: parsed.guestEmailDomains,
    },
  });
}

export async function bulkMatchZoomUnmatched(
  tx: TenantTx,
  ctx: ServiceCtx,
  body: ZoomUnmatchedBulkMatchBody,
) {
  let items = body.items ?? [];

  if (body.mode === "all_high") {
    const listed = await listZoomUnmatchedIdentities(tx, ctx, {
      group: "high",
      page: 1,
      limit: 100,
    });
    items = listed.data.groups.high
      .map((item) => {
        const top = item.suggestions[0];
        if (!top || top.confidence !== "high") return null;
        return {
          identityKey: item.identityKey,
          membershipId: top.membershipId,
          representativeMeetingId: item.representativeMeetingId,
          representativeParticipantId: item.representativeParticipantId,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value != null);
  }

  if (items.length === 0) {
    throw zoomParticipantMatchInvalid("No identities selected to match.");
  }

  const results: Array<{
    identityKey: string;
    membershipId: string | null;
    matchState: "matched" | "unmatched" | "guest";
    updatedRowCount: number;
    updatedMeetingCount: number;
    error?: string;
  }> = [];

  let matchedCount = 0;
  let updatedRowCount = 0;
  let updatedMeetingCount = 0;

  for (const item of items) {
    try {
      const matched = await mutateZoomMeetingParticipantMatch(
        tx,
        ctx,
        item.representativeMeetingId,
        item.representativeParticipantId,
        {
          action: "match",
          membershipId: item.membershipId,
          applyToOtherMeetings: body.applyToOtherMeetings,
        },
      );
      matchedCount += 1;
      updatedRowCount += matched.data.updatedRowCount;
      updatedMeetingCount += matched.data.updatedMeetingCount;
      results.push({
        identityKey: item.identityKey,
        membershipId: matched.data.membershipId,
        matchState: matched.data.matchState,
        updatedRowCount: matched.data.updatedRowCount,
        updatedMeetingCount: matched.data.updatedMeetingCount,
      });
    } catch (error) {
      results.push({
        identityKey: item.identityKey,
        membershipId: null,
        matchState: "unmatched",
        updatedRowCount: 0,
        updatedMeetingCount: 0,
        error: error instanceof Error ? error.message : "Match failed.",
      });
    }
  }

  return zoomUnmatchedBulkMatchResponseSchema.parse({
    data: {
      matchedCount,
      updatedRowCount,
      updatedMeetingCount,
      results,
    },
  });
}
