import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminDevicesPanel } from "../../../features/admin/domain/AdminDevicesPanel";

export default function AdminDevicesPage() {
  return (
    <AdminPageGate screenId="T57" state="ready" title="Device Sessions">
      <AdminDevicesPanel />
    </AdminPageGate>
  );
}
