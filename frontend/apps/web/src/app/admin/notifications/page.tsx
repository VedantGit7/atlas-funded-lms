import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminNotificationsInbox } from "../../../features/notifications/components/AdminNotificationsInbox";

// Inbox auth failures (401/403 denied) are handled client-side via ClientApiError in AdminNotificationsInbox.

export default function AdminNotificationsPage() {
  return (
    <AdminPageGate screenId="T26" state="ready" title="Notifications">
      <main>
        <AdminNotificationsInbox />
      </main>
    </AdminPageGate>
  );
}
