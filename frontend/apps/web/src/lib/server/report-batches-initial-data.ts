import "server-only";
import {
  BATCH_CONTENT_LEARNERS_DEFAULTS,
  BATCH_LEARNERS_DEFAULTS,
  BATCH_LEARNER_COLUMN_OPTIONS,
  BATCH_MESSAGES_PAGE_SIZE,
  batchContentLearnersPath,
  batchContentPath,
  batchDetailPath,
  batchExamsMatrixPath,
  batchExamsPath,
  batchLearnerDetailPath,
  batchLearnersPath,
  batchLiveSessionAttendeesPath,
  batchLiveSessionDetailPath,
  batchLiveSessionsMatrixPath,
  batchLiveSessionsPath,
  batchMessageAudiencesPath,
  batchMessageNudgesPath,
  batchMessagesPath,
  batchesComparePath,
  parseBatchDetailTab,
  parseBatchesCompareIds,
  readBatchContentAddress,
  readBatchExamsAddress,
  readBatchLiveSessionsAddress,
  readBatchSessionAttendanceAddress,
  type AddressReader,
  type BatchContentLearnersPayload,
  type BatchContentReportData,
  type BatchDetail,
  type BatchExamsInitial,
  type BatchExamsListData,
  type BatchExamsMatrixData,
  type BatchLearnerDetail,
  type BatchLearnersPayload,
  type BatchLiveSessionAttendeesPayload,
  type BatchLiveSessionDetailData,
  type BatchLiveSessionsInitial,
  type BatchLiveSessionsListData,
  type BatchLiveSessionsMatrixData,
  type BatchMessageAudiencesPayload,
  type BatchMessageNudgesPayload,
  type BatchMessagesInitial,
  type BatchMessagesListData,
  type BatchSessionAttendanceInitial,
  type BatchesCompareData,
} from "../../features/admin/reports/admin-batches-roster-api";
import { loadReportInitialData, type ReportInitialData } from "./report-initial-data";
import { searchParam, type ReportSearchParams } from "./report-landing-initial-data";

/*
 * The first data each Batches page shows, loaded on the server so the page
 * arrives filled in. Every path is the one the page's own first browser load
 * would request for the same address, so the page can skip that load; each
 * resolves null on failure and the page then loads in the browser as before.
 */

function addressOf(params: ReportSearchParams): AddressReader {
  return (name) => searchParam(params, name) ?? null;
}

/**
 * Loads that a page makes together and sets together, as one value: null if
 * any fails, as the page's own load then shows its error.
 */
async function loadTogether<T extends Record<string, unknown>>(loads: {
  [K in keyof T]: Promise<ReportInitialData<T[K]> | null>;
}): Promise<ReportInitialData<T> | null> {
  const keys = Object.keys(loads) as Array<keyof T>;
  const results = await Promise.all(keys.map((key) => loads[key]));
  if (results.some((result) => result === null)) return null;
  const data = {} as T;
  let loadedAt = Infinity;
  keys.forEach((key, index) => {
    const result = results[index] as ReportInitialData<T[typeof key]>;
    data[key] = result.data;
    loadedAt = Math.min(loadedAt, result.loadedAt);
  });
  return { data, loadedAt };
}

/** A batch and, when the address opens the learners tab, its first page of learners. */
export async function loadBatchDetailData(batchId: string, params: ReportSearchParams) {
  const onLearners = parseBatchDetailTab(searchParam(params, "tab") ?? null) === "learners";
  const [detail, learners] = await Promise.all([
    loadReportInitialData<BatchDetail>(batchDetailPath(batchId)),
    onLearners
      ? loadReportInitialData<BatchLearnersPayload>(
          batchLearnersPath(batchId, {
            ...BATCH_LEARNERS_DEFAULTS,
            columns: BATCH_LEARNER_COLUMN_OPTIONS.map((column) => column.key),
          }),
        )
      : null,
  ]);
  return { detail, learners };
}

/** The content report and, once it names a course, the learners the address asks for. */
export async function loadBatchContentData(batchId: string, params: ReportSearchParams) {
  const report = await loadReportInitialData<BatchContentReportData>(batchContentPath(batchId));
  if (!report?.data.courseId) return { report, learners: null };
  const { q, view, page } = readBatchContentAddress(addressOf(params));
  const learners = await loadReportInitialData<BatchContentLearnersPayload>(
    batchContentLearnersPath(batchId, {
      q: q.trim() || undefined,
      view,
      sortBy: BATCH_CONTENT_LEARNERS_DEFAULTS.sortBy,
      sortDir: BATCH_CONTENT_LEARNERS_DEFAULTS.sortDir,
      page,
      limit: BATCH_CONTENT_LEARNERS_DEFAULTS.limit,
    }),
  );
  return { report, learners };
}

/** The exams list, filtered by the address; in matrix view the matrix and the whole list. */
export function loadBatchExamsData(
  batchId: string,
  params: ReportSearchParams,
): Promise<ReportInitialData<BatchExamsInitial> | null> {
  const { view, q } = readBatchExamsAddress(addressOf(params));
  const search = q.trim() || undefined;
  if (view === "matrix") {
    return loadTogether<BatchExamsInitial>({
      matrix: loadReportInitialData<BatchExamsMatrixData>(
        batchExamsMatrixPath(batchId, { q: search }),
      ),
      list: loadReportInitialData<BatchExamsListData>(batchExamsPath(batchId)),
    });
  }
  return loadTogether<BatchExamsInitial>({
    list: loadReportInitialData<BatchExamsListData>(batchExamsPath(batchId, { q: search })),
    matrix: Promise.resolve({ data: null, loadedAt: Infinity }),
  });
}

export function loadBatchLearnerData(batchId: string, membershipId: string) {
  return loadReportInitialData<BatchLearnerDetail>(batchLearnerDetailPath(batchId, membershipId));
}

/** The sessions the address asks for; in matrix view the matrix and the summary. */
export function loadBatchLiveSessionsData(
  batchId: string,
  params: ReportSearchParams,
): Promise<ReportInitialData<BatchLiveSessionsInitial> | null> {
  const { view, q, page, sortBy, sortDir } = readBatchLiveSessionsAddress(addressOf(params));
  const search = q.trim() || undefined;
  if (view === "matrix") {
    return loadTogether<BatchLiveSessionsInitial>({
      matrix: loadReportInitialData<BatchLiveSessionsMatrixData>(
        batchLiveSessionsMatrixPath(batchId, { q: search }),
      ),
      list: loadReportInitialData<BatchLiveSessionsListData>(
        batchLiveSessionsPath(batchId, { page: 1, limit: 1 }),
      ),
    });
  }
  return loadTogether<BatchLiveSessionsInitial>({
    list: loadReportInitialData<BatchLiveSessionsListData>(
      batchLiveSessionsPath(batchId, { q: search, sortBy, sortDir, page, limit: 25 }),
    ),
    matrix: Promise.resolve({ data: null, loadedAt: Infinity }),
  });
}

/** A live session and the attendees the address asks for. */
export function loadBatchSessionAttendanceData(
  batchId: string,
  sessionId: string,
  params: ReportSearchParams,
) {
  const { q, page, sortBy, sortDir, kind } = readBatchSessionAttendanceAddress(addressOf(params));
  return loadTogether<BatchSessionAttendanceInitial>({
    detail: loadReportInitialData<BatchLiveSessionDetailData>(
      batchLiveSessionDetailPath(batchId, sessionId),
    ),
    attendees: loadReportInitialData<BatchLiveSessionAttendeesPayload>(
      batchLiveSessionAttendeesPath(batchId, sessionId, {
        ...(q.trim() ? { q: q.trim() } : {}),
        attendanceKind: kind,
        sortBy,
        sortDir,
        page,
        limit: 25,
      }),
    ),
  });
}

/** The first page of message history, the audiences and the nudges. */
export function loadBatchMessagesData(batchId: string) {
  return loadTogether<BatchMessagesInitial>({
    messages: loadReportInitialData<BatchMessagesListData>(
      batchMessagesPath(batchId, { page: 1, limit: BATCH_MESSAGES_PAGE_SIZE }),
    ),
    audiences: loadReportInitialData<BatchMessageAudiencesPayload>(
      batchMessageAudiencesPath(batchId),
    ),
    nudges: loadReportInitialData<BatchMessageNudgesPayload>(batchMessageNudgesPath(batchId)),
  });
}

/** The comparison of the batches the address names; nothing for fewer than two. */
export async function loadBatchesCompareData(params: ReportSearchParams) {
  const ids = parseBatchesCompareIds(searchParam(params, "ids") ?? null);
  if (ids.length < 2) return null;
  return loadReportInitialData<BatchesCompareData>(batchesComparePath(ids, "week_of_batch"));
}
