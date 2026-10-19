import "server-only";
import {
  CUSTOM_FIELD_CATALOGUE_DEFAULTS,
  CUSTOM_FIELD_COHORTS_PAGE_SIZE,
  CUSTOM_FIELD_DETAIL_PAGE_SIZE,
  customFieldCataloguePath,
  customFieldCohortGroupsPath,
  customFieldCohortMessagesPath,
  customFieldDetailPath,
  customFieldLearnerDetailPath,
  type CustomFieldCataloguePayload,
  type CustomFieldCohortGroupsPayload,
  type CustomFieldCohortMessagesPayload,
  type CustomFieldCohortsInitial,
  type CustomFieldDetailData,
  type CustomFieldLearnerDetailData,
} from "../../features/admin/reports/admin-custom-field-roster-api";
import {
  CUSTOM_FIELD_SEGMENTS_PATH,
  CUSTOM_FIELD_SEGMENT_LEARNERS_PAGE_SIZE,
  SEGMENT_FIELD_CATALOGUE_FILTERS,
  customFieldSegmentLearnersPath,
  customFieldSegmentPath,
  customFieldSegmentViewPath,
  type CustomFieldSegmentItem,
  type CustomFieldSegmentLearnersPayload,
  type CustomFieldSegmentViewPayload,
  type CustomFieldSegmentsPayload,
  type SegmentBuilderInitial,
} from "../../features/admin/reports/admin-custom-field-segments-api";
import { loadReportInitialData, type ReportInitialData } from "./report-initial-data";

/*
 * The first data each Custom field page shows, loaded on the server so the
 * page arrives filled in. Every path is the one the page's own first browser
 * load would request, so the page can skip that load; each resolves null on
 * failure and the page then loads in the browser as before.
 */

/** The first page of cohort groups and of messages, which the page loads together. */
export async function loadCustomFieldCohortsData(): Promise<ReportInitialData<CustomFieldCohortsInitial> | null> {
  const [groups, messages] = await Promise.all([
    loadReportInitialData<CustomFieldCohortGroupsPayload>(
      customFieldCohortGroupsPath({ page: 1, limit: CUSTOM_FIELD_COHORTS_PAGE_SIZE }),
    ),
    loadReportInitialData<CustomFieldCohortMessagesPayload>(
      customFieldCohortMessagesPath({ page: 1, limit: CUSTOM_FIELD_COHORTS_PAGE_SIZE }),
    ),
  ]);
  if (!groups || !messages) return null;
  return {
    data: { groups: groups.data, messages: messages.data },
    loadedAt: Math.min(groups.loadedAt, messages.loadedAt),
  };
}

/** The field catalogue as it opens: every status, lowest coverage first. */
export function loadCustomFieldCatalogueData() {
  return loadReportInitialData<CustomFieldCataloguePayload>(
    customFieldCataloguePath(CUSTOM_FIELD_CATALOGUE_DEFAULTS),
  );
}

/** A field and its first page of learners. */
export function loadCustomFieldDetailData(fieldKey: string) {
  return loadReportInitialData<CustomFieldDetailData>(
    customFieldDetailPath(fieldKey, { page: 1, limit: CUSTOM_FIELD_DETAIL_PAGE_SIZE }),
  );
}

export function loadCustomFieldLearnerData(membershipId: string) {
  return loadReportInitialData<CustomFieldLearnerDetailData>(
    customFieldLearnerDetailPath(membershipId),
  );
}

export function loadCustomFieldSegmentsData() {
  return loadReportInitialData<CustomFieldSegmentsPayload>(CUSTOM_FIELD_SEGMENTS_PATH);
}

/** A segment's view and, once it loaded, its first page of matched learners. */
export async function loadCustomFieldSegmentDetailData(segmentId: string) {
  const view = await loadReportInitialData<CustomFieldSegmentViewPayload>(
    customFieldSegmentViewPath(segmentId),
  );
  const learners = view
    ? await loadReportInitialData<CustomFieldSegmentLearnersPayload>(
        customFieldSegmentLearnersPath(segmentId, {
          page: 1,
          limit: CUSTOM_FIELD_SEGMENT_LEARNERS_PAGE_SIZE,
        }),
      )
    : null;
  return { view, learners };
}

/** The segment builder's field catalogue and, when editing, the segment. */
export async function loadSegmentBuilderData(
  segmentId?: string,
): Promise<ReportInitialData<SegmentBuilderInitial> | null> {
  const [catalogue, segment] = await Promise.all([
    loadReportInitialData<CustomFieldCataloguePayload>(
      customFieldCataloguePath(SEGMENT_FIELD_CATALOGUE_FILTERS),
    ),
    segmentId
      ? loadReportInitialData<CustomFieldSegmentItem>(customFieldSegmentPath(segmentId))
      : null,
  ]);
  if (!catalogue || (segmentId && !segment)) return null;
  return {
    data: { catalogue: catalogue.data, segment: segment?.data ?? null },
    loadedAt: Math.min(catalogue.loadedAt, segment?.loadedAt ?? Infinity),
  };
}
