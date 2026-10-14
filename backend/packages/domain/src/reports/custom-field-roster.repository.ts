import { customFieldRosterLearnersRepository } from "./custom-field-roster-learners.repository";
import { customFieldRosterFieldsRepository } from "./custom-field-roster-fields.repository";
import { customFieldRosterLearnerDetailRepository } from "./custom-field-roster-learner-detail.repository";

export type CustomFieldDefRow = {
  id: string;
  key: string;
  label: string;
  field_type: string;
};

export type CustomFieldLearnerRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  status: string;
  enrollment_count: number;
  total_spent_cents: number;
  currency: string;
  last_active_at: Date | null;
  signed_up_at: Date | null;
};

export type CustomFieldLearnerValueRow = {
  membership_id: string;
  field_key: string;
  value_json: unknown;
};

export type CustomFieldRosterFilter = {
  q?: string;
  email?: string;
  status?: string;
  signedUpFrom?: string;
  signedUpTo?: string;
  minTotalSpentCents?: number;
  maxTotalSpentCents?: number;
};

/** The custom field roster queries, kept in one file per report area. */
export const customFieldRosterRepository = {
  ...customFieldRosterLearnersRepository,
  ...customFieldRosterFieldsRepository,
  ...customFieldRosterLearnerDetailRepository,
};
