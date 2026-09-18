import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminNotificationsInbox } from "../../../features/notifications/components/AdminNotificationsInbox";

// Inbox auth failures (401/403) render the denied gate from inside
// AdminNotificationsInbox, which is where the fetch happens.

export default function AdminNotificationsPage() {
  return (
    <AdminPageGate screenId="T26" state="ready" title="Notifications">
      <main>
        <AdminNotificationsInbox />
      </main>
    </AdminPageGate>
  );
}
