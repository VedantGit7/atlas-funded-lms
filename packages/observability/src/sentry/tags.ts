import { readDeploymentEnvironment, readReleaseIdentifier } from "../release";

export type SafeSentryTags = {
  requestId: string;
  parentRequestId?: string;
  route?: string;
  routeGroup?: string;
  environment?: string;
  release?: string;
  module?: string;
  eventType?: string;
  jobName?: string;
  tenantSafeId?: string;
  actorSafeId?: string;
  actorPlane?: "tenant" | "platform" | "public";
};

export function toSafeSentryTagRecord(tags: SafeSentryTags): Record<string, string> {
  const record: Record<string, string> = {
    requestId: tags.requestId,
    environment: tags.environment ?? readDeploymentEnvironment(),
  };

  if (tags.parentRequestId) {
    record["parentRequestId"] = tags.parentRequestId;
  }

  if (tags.route) {
    record["route"] = tags.route;
  }

  if (tags.routeGroup) {
    record["routeGroup"] = tags.routeGroup;
  }

  const release = tags.release ?? readReleaseIdentifier();
  if (release) {
    record["release"] = release;
  }

  if (tags.module) {
    record["module"] = tags.module;
  }

  if (tags.eventType) {
    record["eventType"] = tags.eventType;
  }

  if (tags.jobName) {
    record["jobName"] = tags.jobName;
  }

  if (tags.tenantSafeId) {
    record["tenantSafeId"] = tags.tenantSafeId;
  }

  if (tags.actorSafeId) {
    record["actorSafeId"] = tags.actorSafeId;
  }

  if (tags.actorPlane) {
    record["actorPlane"] = tags.actorPlane;
  }

  return record;
}
