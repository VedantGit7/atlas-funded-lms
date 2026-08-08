import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  TRASH_RETENTION_DAYS,
  type ContentTrashActionBody,
  type ContentTrashActionResponse,
  type ContentTrashActivityResponse,
  type ContentTrashKind,
  type ContentTrashListResponse,
} from "./content-trash.contract";
import {
  listTrashActivity,
  listTrashedCourses,
  listTrashedLessons,
  listTrashedSections,
  purgeTrashedCourse,
  purgeTrashedLesson,
  purgeTrashedSection,
  restoreTrashedCourse,
  restoreTrashedLesson,
  restoreTrashedSection,
  toTrashItem,
} from "./content-trash.repository";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function trashItemNotFound(): never {
  throw new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Trash item not found or no longer restorable.",
  });
}

function targetTypeForKind(kind: ContentTrashKind): string {
  if (kind === "courses") return "course";
  if (kind === "sections") return "course_module";
  return "lesson";
}

function actionLabel(action: string): string {
  switch (action) {
    case "course.archived":
      return "Moved course to trash";
    case "course.module.deleted":
      return "Moved section to trash";
    case "course.lesson.deleted":
      return "Moved lesson to trash";
    case "content.trash.restored":
      return "Restored from trash";
    case "content.trash.purged":
      return "Permanently deleted from trash";
    default:
      return action;
  }
}

export async function listContentTrash(
  tx: Tx,
  kind: ContentTrashKind,
): Promise<ContentTrashListResponse> {
  const rows =
    kind === "courses"
      ? await listTrashedCourses({ tx })
      : kind === "sections"
        ? await listTrashedSections({ tx })
        : await listTrashedLessons({ tx });

  return {
    data: {
      kind,
      retentionDays: TRASH_RETENTION_DAYS,
      items: rows.map((row) => toTrashItem(row, kind)),
    },
  };
}

export async function listContentTrashActivity(
  tx: Tx,
  input: { q?: string; limit: number },
): Promise<ContentTrashActivityResponse> {
  const rows = await listTrashActivity({
    tx,
    ...(input.q ? { q: input.q } : {}),
    limit: input.limit,
  });

  return {
    data: {
      items: rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurred_at.toISOString(),
        action: row.action,
        actionLabel: actionLabel(row.action),
        targetType: row.target_type,
        targetId: row.target_id,
        adminName: row.admin_name?.trim() || "Admin",
        actorMembershipId: row.actor_membership_id,
      })),
    },
  };
}

export async function restoreContentTrash(
  tx: Tx,
  ctx: ServiceCtx,
  input: ContentTrashActionBody,
): Promise<ContentTrashActionResponse> {
  const ok =
    input.kind === "courses"
      ? await restoreTrashedCourse({ tx, id: input.id })
      : input.kind === "sections"
        ? await restoreTrashedSection({ tx, id: input.id })
        : await restoreTrashedLesson({ tx, id: input.id });

  if (!ok) {
    trashItemNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "content.trash.restored",
      target: { type: targetTypeForKind(input.kind), id: input.id },
      before: { deleted: true },
      after: { deleted: false },
      reason: null,
      metadata: { kind: input.kind },
    },
  );

  return {
    data: {
      id: input.id,
      kind: input.kind,
      action: "restore",
    },
  };
}

export async function purgeContentTrash(
  tx: Tx,
  ctx: ServiceCtx,
  input: ContentTrashActionBody,
): Promise<ContentTrashActionResponse> {
  const ok =
    input.kind === "courses"
      ? await purgeTrashedCourse({ tx, id: input.id })
      : input.kind === "sections"
        ? await purgeTrashedSection({ tx, id: input.id })
        : await purgeTrashedLesson({ tx, id: input.id });

  if (!ok) {
    trashItemNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "content.trash.purged",
      target: { type: targetTypeForKind(input.kind), id: input.id },
      before: { deleted: true },
      after: { purged: true },
      reason: null,
      metadata: { kind: input.kind },
    },
  );

  return {
    data: {
      id: input.id,
      kind: input.kind,
      action: "purge",
    },
  };
}
