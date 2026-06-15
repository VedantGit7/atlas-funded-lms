# Database Scripts

## Purpose

This folder contains local and CI-safe database helper scripts.

## Current scripts

- `apply-sql-directory.mjs` — applies SQL files from an approved SQL directory.
- `check-no-session-tenant-set.mjs` — blocks unsafe session-level tenant GUC usage.
- `check-sql-approved-paths.mjs` — blocks raw SQL files outside approved folders.

## Rules

- Scripts must not contain production secrets.
- Scripts must load database URLs from environment only.
- Scripts must not bypass migration review.
- Scripts must not create unapproved tables, entities, APIs, screens, workflows, or permissions.
