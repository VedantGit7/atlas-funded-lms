import { createHash } from "node:crypto";

export function buildReadReceiptIdempotencyKey(args: {
  dispatchId: string;
  membershipId: string;
}): string {
  return createHash("sha256").update(`read:${args.dispatchId}:${args.membershipId}`).digest("hex");
}

export function buildArchiveReceiptIdempotencyKey(args: {
  dispatchId: string;
  membershipId: string;
}): string {
  return createHash("sha256")
    .update(`archive:${args.dispatchId}:${args.membershipId}`)
    .digest("hex");
}

export function buildNotificationIdempotencyKey(args: {
  sourceEventId: string;
  templateId: string;
  recipientMembershipId: string;
  channel: string;
}): string {
  const material = [
    args.sourceEventId,
    args.templateId,
    args.recipientMembershipId,
    args.channel,
  ].join(":");
  return createHash("sha256").update(material).digest("hex");
}
