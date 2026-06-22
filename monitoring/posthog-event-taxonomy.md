# PostHog Event Taxonomy

## Allowed events

- `diagnostic_started`
- `diagnostic_completed`
- `signup_completed`
- `lesson_completed`
- `assessment_attempt_started`
- `assessment_submitted`
- `swipe_session_completed`
- `readiness_viewed`
- `cta_outbound_clicked`
- `certificate_verified`
- `community_post_created`
- `admin_workflow_action`

## Allowed properties

`tenantSafeId`, `actorSafeId`, `actorPlane`, `routeGroup`, `release`, `environment`, `source`, `contentType`, `assessmentType`, `workflowAction`, `outcome`

## Forbidden

No PII, tokens, assessment answers, diagnostic answers, content bodies, moderation evidence, raw tenant IDs, or session replay.

## Server-confirmed mapping (outbox)

| Outbox event                 | PostHog event                |
| ---------------------------- | ---------------------------- |
| `lesson.completed`           | `lesson_completed`           |
| `assessment.started`         | `assessment_attempt_started` |
| `assessment.submitted`       | `assessment_submitted`       |
| `practice.session_completed` | `swipe_session_completed`    |
| `community.post.created`     | `community_post_created`     |
| `workflow.transitioned`      | `admin_workflow_action`      |

Client-only events (diagnostic, signup, readiness, CTA, certificate verify) must use the approved client adapter.
