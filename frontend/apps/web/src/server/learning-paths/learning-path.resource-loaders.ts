import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { findPathAuthProjection, findPathEnrollment } from "./learning-path.repository";
import { learningPathNotFound } from "./learning-path.errors";
import type { PathDetailQuery } from "./learning-path.schemas";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export async function loadLearningPathResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  pathId: string;
  requirePublished?: boolean;
}) {
  const path = await findPathAuthProjection({ tx: args.tx, pathId: args.pathId });

  if (!path) {
    throw learningPathNotFound();
  }

  if (args.requirePublished !== false && path.status !== "PUBLISHED") {
    throw learningPathNotFound();
  }

  const enrollment = await findPathEnrollment({
    tx: args.tx,
    pathId: args.pathId,
    membershipId: args.ctx.actorMembershipId,
  });

  const relationships: Record<string, boolean | string> = {};

  if (path.status === "PUBLISHED") {
    relationships["publishedLearnerVisible"] = true;
  }

  if (enrollment) {
    relationships["enrolledInPath"] = args.ctx.actorMembershipId;
    relationships["selfProgress"] = args.ctx.actorMembershipId;
  }

  if (path.createdByMembershipId === args.ctx.actorMembershipId) {
    relationships["instructorOfPath"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "learning_path",
    id: path.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: path.createdByMembershipId,
    relationships,
  });
}

export async function loadLearningPathCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "learning_path_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
      relationships: {
        publishedLearnerVisible: true,
      },
    }),
  );
}

export async function loadLearningPathStudioCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "learning_path_studio_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
      relationships: {
        instructorOfPath: args.ctx.actorMembershipId,
      },
    }),
  );
}

export async function loadLearningPathForEnrollmentResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  pathId: string;
}) {
  return loadLearningPathResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    pathId: args.pathId,
    requirePublished: true,
  });
}

export async function loadLearningPathProgressResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  pathId: string;
}) {
  const ref = await loadLearningPathResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    pathId: args.pathId,
    requirePublished: true,
  });

  const enrollment = await findPathEnrollment({
    tx: args.tx,
    pathId: args.pathId,
    membershipId: args.ctx.actorMembershipId,
  });

  if (enrollment) {
    return {
      ...ref,
      relationships: {
        ...ref.relationships,
        selfProgress: args.ctx.actorMembershipId,
        enrolledInPath: args.ctx.actorMembershipId,
      },
    };
  }

  return ref;
}

export function resolvePathDetailPublishedRequirement(query: PathDetailQuery): boolean {
  return query.view !== "studio";
}
