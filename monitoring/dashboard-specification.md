# Dashboard Specification

## Sentry

- Error rate by `routeGroup`
- P95 latency for tenant API routes
- Worker failures tagged with `jobName` and `parentRequestId`
- Release comparison view using `release` tag

## Better Stack

- Health check success rate per host
- Worker heartbeat age
- Structured log volume by `level`
- Top `errorCode` values (no message body inspection in alerts)

## PostHog

- Funnel: diagnostic_started → signup_completed
- Learning engagement: lesson_completed, assessment_submitted
- Admin workflow actions by `workflowAction`

All dashboards are configured manually in provider UIs. This document is the specification only.
