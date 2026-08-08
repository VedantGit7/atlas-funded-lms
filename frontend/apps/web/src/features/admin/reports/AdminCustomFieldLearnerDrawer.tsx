"use client";

import { AdminCustomFieldLearnerValuesView } from "./AdminCustomFieldLearnerValuesView";

type Props = {
  membershipId: string | null;
  onClose: () => void;
};

export function AdminCustomFieldLearnerDrawer({ membershipId, onClose }: Props) {
  if (!membershipId) return null;

  return (
    <AdminCustomFieldLearnerValuesView
      membershipId={membershipId}
      variant="drawer"
      onClose={onClose}
    />
  );
}
