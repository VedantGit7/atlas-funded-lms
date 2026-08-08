-- Migration 050: add home currency (ISO 4217 code) to learner billing config.

ALTER TABLE "learner_billing_config" ADD COLUMN "home_currency" TEXT;
