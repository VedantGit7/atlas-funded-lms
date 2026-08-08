-- Migration 053: learner billing checkout-request flags (learner configurations).

ALTER TABLE "learner_billing_config"
  ADD COLUMN "request_billing_address" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "request_shipping_address" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "request_gstin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "request_mobile" BOOLEAN NOT NULL DEFAULT false;
