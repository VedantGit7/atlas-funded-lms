export const OWNERSHIP_OR_RELATIONSHIP_PERMISSIONS = new Set<string>([
  "post.delete",
  "comment.delete",
]);

export function allowsOwnershipOrRelationship(permission: string): boolean {
  return OWNERSHIP_OR_RELATIONSHIP_PERMISSIONS.has(permission);
}
