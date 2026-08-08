import type { AdminOverviewResponse } from "./admin-overview.contract";
import { loadAdminOverviewRaw } from "./admin-overview.repository";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function getAdminOverview(
  tx: Tx,
  ctx: { tenantId: string },
): Promise<AdminOverviewResponse> {
  const raw = await loadAdminOverviewRaw({ tx, tenantId: ctx.tenantId });

  return {
    data: {
      currency: raw.currency,
      kpis: {
        enrollmentValueCents: raw.enrollmentValueCents,
        productCount: raw.productCount,
        learnerCount: raw.learnerCount,
        enrollmentCount: raw.enrollmentCount,
      },
      enrollmentBreakdown: {
        last12MonthsValueCents: raw.last12MonthsValueCents,
        paidValueCents: raw.paidValueCents,
        freeEnrollmentCount: raw.freeEnrollmentCount,
        paidEnrollmentCount: raw.paidEnrollmentCount,
      },
      monthlyEnrollments: raw.monthly.map((row) => ({
        month: monthKey(row.month),
        paid: Number(row.paid),
        free: Number(row.free),
      })),
      topProducts: raw.topProducts.map((row) => ({
        id: row.id,
        title: row.title,
        studentCount: Number(row.student_count),
        priceCents: row.price_cents,
        currency: row.currency,
        href: `/studio/courses/${row.id}`,
      })),
      scheduledEvents: raw.scheduledEvents.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
      })),
      pendingTasks: {
        publishReviews: raw.publishReviews,
        moderationCases: raw.moderationCases,
        deletionRequests: raw.deletionRequests,
        courseReviews: raw.courseReviews,
      },
    },
  };
}
