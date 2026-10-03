/**
 * System actor identity for requests that no member initiated.
 *
 * Audit finding M16. Six entry points — **including both payment webhooks** —
 * passed `actorMembershipId: tenant.tenantId`. That is not merely imprecise: a
 * tenant id is not a membership id, so every audit entry written on the most
 * financially sensitive events in the product attributed the action to a
 * membership that does not exist. Joining `audit_entries` to `memberships` for
 * those rows returns nothing, and the audit trail silently answers "who did
 * this?" with a value from the wrong table.
 *
 * These requests are genuinely un-attributable to a person — Stripe, Razorpay
 * and Zoom call them, and public marketing actions run before any session
 * exists. The honest record is therefore "the system did this, via <source>",
 * not a fabricated member.
 *
 * `audit_entries.actor_membership_id` is nullable, so the writer maps this
 * sentinel to NULL and records the source in `metadata_json`. The sentinel
 * exists only so `ServiceCtx.actorMembershipId` can stay a non-nullable
 * `string`: widening it touches 1500+ references and is its own change.
 *
 * The nil UUID can never collide with a real membership — those are UUID v7.
 */
export const SYSTEM_ACTOR_MEMBERSHIP_ID = "00000000-0000-0000-0000-000000000000";

/** Where an un-attributable request came from. Recorded on the audit entry. */
export type SystemActorSource =
  | "payments.stripe.webhook"
  | "payments.razorpay.webhook"
  | "zoom.webhook"
  | "marketing.public_action"
  | "sales.public_attribution"
  | "assessments.attempt_deadline";

export function isSystemActor(actorMembershipId: string | null | undefined): boolean {
  return actorMembershipId === SYSTEM_ACTOR_MEMBERSHIP_ID;
}

/**
 * Build a service context for an un-attributable request.
 *
 * Prefer this over hand-writing `actorMembershipId`, so the sentinel and its
 * source stay together and the entry point declares which system it is.
 */
export function systemServiceCtx(args: {
  tenantId: string;
  requestId: string;
  source: SystemActorSource;
}): {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
  systemSource: SystemActorSource;
} {
  return {
    tenantId: args.tenantId,
    actorMembershipId: SYSTEM_ACTOR_MEMBERSHIP_ID,
    requestId: args.requestId,
    systemSource: args.source,
  };
}
