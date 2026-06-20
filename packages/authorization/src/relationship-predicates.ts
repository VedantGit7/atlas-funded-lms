import type { AuthorizationActor, ResourceRef } from "./types";

const RELATIONSHIP_PERMISSION_MAP: Record<string, string[]> = {
  "course.update": ["instructorOfCourse"],
  "course.publish": ["instructorOfCourse"],
  "assessment.grade": ["assigneeOfGradingTask", "instructorOfCourse"],
  "community.moderate": ["moderatorOfSpace"],
  "post.create": ["memberOfSpace"],
  "comment.create": ["memberOfSpace"],
  "course.read": ["enrolledInCourse", "instructorOfCourse", "publishedLearnerVisible"],
  "learning_path.read": ["enrolledInPath", "instructorOfPath", "publishedLearnerVisible"],
  "learning_path.update": ["instructorOfPath"],
  "learning_path.delete": ["instructorOfPath"],
  "learning_path.publish": ["instructorOfPath"],
  "learning_path.create": ["instructorOfPath"],
  "progress.read": [
    "selfProgress",
    "instructorOfCourse",
    "instructorOfPath",
    "publishedLearnerVisible",
  ],
  "attempt.read": ["selfAttempt", "instructorOfCourse", "assigneeOfGradingTask"],
  "competency.score.read": ["selfCompetencyScore", "instructorOfCourse", "instructorOfPath"],
  "diagnostic.start": ["selfDiagnosticSession", "publishedLearnerVisible"],
  "workflow.transition.act": ["workflowApproverEligible", "moderatorOfSpace"],
};

export function requiredRelationships(permission: string): string[] {
  return RELATIONSHIP_PERMISSION_MAP[permission] ?? [];
}

export function hasRequiredRelationship(args: {
  actor: AuthorizationActor;
  resource: ResourceRef;
  permission: string;
}): boolean {
  const required = requiredRelationships(args.permission);

  if (required.length === 0) {
    return true;
  }

  for (const relationshipKey of required) {
    const value = args.resource.relationships?.[relationshipKey];

    if (value === true) {
      return true;
    }

    if (typeof value === "string" && value === args.actor.membershipId) {
      return true;
    }

    if (Array.isArray(value) && value.includes(args.actor.membershipId)) {
      return true;
    }
  }

  return false;
}
