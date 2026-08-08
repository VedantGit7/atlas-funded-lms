-- Migration 054: billing location status + description (locations redesign).

ALTER TABLE "learner_billing_locations"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published';
