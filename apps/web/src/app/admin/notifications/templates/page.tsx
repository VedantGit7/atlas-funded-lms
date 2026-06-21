import Link from "next/link";
import type { z } from "zod";
import { AdminPageGate, PageHeader } from "../../../../components/patterns/AdminPageGate";
import { NotificationTemplateManager } from "../../../../features/notifications/components/NotificationTemplateManager";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { notificationTemplateListResponseSchema } from "../../../../server/notifications/notification.dto";

type NotificationTemplateListResponse = z.infer<typeof notificationTemplateListResponseSchema>;

export default async function AdminNotificationTemplatesPage() {
  try {
    const templates = await serverApi.get<NotificationTemplateListResponse>(
      "/api/v1/notification-templates",
    );

    return (
      <AdminPageGate screenId="T15" state="ready" title="Notification Templates">
        <main className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="Notification Templates"
              description="Manage in-app and email templates per event, channel, and locale."
            />
            <Link href="/admin" className="text-sm underline">
              Admin dashboard
            </Link>
          </header>
          <NotificationTemplateManager initialTemplates={templates.data} />
        </main>
      </AdminPageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T15"
          state="denied"
          title="Notification Templates"
          deniedMessage="You do not have permission to manage notification templates."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T15"
          state="error"
          title="Notification Templates"
          errorMessage={`Failed to load templates. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
