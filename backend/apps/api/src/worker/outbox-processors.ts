import { processAnalyticsOutboxBatch } from "../server/analytics/analytics-worker-router";
import { processAutomationOutboxBatch } from "../server/automation/automation-worker-router";
import { processCertificateOutboxBatch } from "../server/certificates/certificate-worker-router";
import { processCompetencyOutboxBatch } from "../server/competency/competency-worker-router";
import { processDataRightsOutboxBatch } from "../server/data-rights/data-rights-worker-router";
import { processGamificationOutboxBatch } from "../server/gamification/gamification-worker-router";
import { processNotificationOutboxBatch } from "../server/notifications/notification.worker";
import { processReadinessOutboxBatch } from "../server/readiness/readiness.worker";
import { processReportsOutboxBatch } from "../server/reports/reports-worker-router";
import { processSearchOutboxBatch } from "../server/search/search-worker-router";

export type OutboxBatchResult = {
  processed: number;
  delivered: number;
  failed: number;
  skipped: number;
};

export type OutboxProcessor = {
  name: string;
  run: (args: {
    tenantId: string;
    requestId: string;
    limit?: number;
    maxRetries?: number;
  }) => Promise<OutboxBatchResult>;
};

/**
 * Every outbox consumer group in the platform.
 *
 * Audit finding C6: these ten batch processors were all exported and all
 * unreachable — nothing in the repository ever called them outside tests. Events
 * were written to the outbox by the domain services and then sat there forever,
 * so notifications, search indexing, certificate issuance, gamification,
 * analytics rollups, data-rights fulfilment and automation runs never fired in a
 * deployed environment.
 *
 * Registering them in one list is deliberate: a new consumer group that is not
 * added here is dead code, and `scripts/guards/check-outbox-worker-coverage.mjs`
 * fails the build when an exported `process*OutboxBatch` is missing from it.
 */
export const OUTBOX_PROCESSORS: readonly OutboxProcessor[] = [
  { name: "notifications", run: processNotificationOutboxBatch },
  { name: "search", run: processSearchOutboxBatch },
  { name: "certificates", run: processCertificateOutboxBatch },
  { name: "gamification", run: processGamificationOutboxBatch },
  { name: "competency", run: processCompetencyOutboxBatch },
  { name: "readiness", run: processReadinessOutboxBatch },
  { name: "analytics", run: processAnalyticsOutboxBatch },
  { name: "reports", run: processReportsOutboxBatch },
  { name: "automation", run: processAutomationOutboxBatch },
  { name: "data-rights", run: processDataRightsOutboxBatch },
];
