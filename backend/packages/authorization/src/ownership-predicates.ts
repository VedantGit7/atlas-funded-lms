import type { AuthorizationActor, ResourceRef } from "./types";

const OWNER_BOUND_PERMISSIONS = new Set<string>([
  "profile.update",
  "notification.read.self",

  "course.update",
  "course.delete",
  "course.publish",

  "learning_path.update",
  "learning_path.delete",
  "learning_path.publish",

  "item.update",
  "item.delete",

  "assessment.update",
  "assessment.delete",
  "assessment.publish",

  "attempt.submit",

  "post.update",
  "post.delete",

  "comment.update",
  "comment.delete",

  "appeal.create",
  "data.deletion.request",
]);

export function requiresOwnership(permission: string): boolean {
  return OWNER_BOUND_PERMISSIONS.has(permission) || permission.endsWith(".self");
}

export function actorOwnsResource(args: {
  actor: AuthorizationActor;
  resource: ResourceRef;
}): boolean {
  return args.resource.ownerMembershipId === args.actor.membershipId;
}
