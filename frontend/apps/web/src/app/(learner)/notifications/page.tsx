import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { LearnerNotificationsClient } from "../../../features/notifications/components/LearnerNotificationsClient";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { z } from "zod";
import type { notificationInboxListResponseSchema } from "@atlas/contracts/notifications/notification.dto";

type NotificationInboxListResponse = z.infer<typeof notificationInboxListResponseSchema>;

export default async function LearnerNotificationsPage() {
  try {
    const response = await serverApi.get<NotificationInboxListResponse>(
      "/api/v1/me/notifications?limit=25",
    );

    return (
      <PageGate state="ready" title="Notifications">
        <main className="space-y-6">
          <PageHeader
            title="Notifications"
            description="Read in-app notifications from your learning activity."
          />
          <LearnerNotificationsClient
            initialItems={response.data}
            initialNextCursor={response.page.nextCursor}
            initialHasMore={response.page.hasMore}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Notifications"
          deniedMessage="You do not have permission to view notifications."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Notifications"
          errorMessage={`Failed to load notifications. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
