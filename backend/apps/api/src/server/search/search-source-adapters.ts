import { can } from "@atlas/authorization";
import type { SearchSourceAdapter } from "@atlas/domain/search/search-source-registry";
import { registerSearchSourceAdapter } from "@atlas/domain/search/search-source-registry";
import { coursePublishedPayloadSchema } from "@atlas/domain/search/search.events";
import { communityPostCreatedPayloadSchema } from "@atlas/domain/search/search.events";
import { certificateIssuedOutboxPayloadSchema } from "../certificates/certificate.dto";
import { certificateRepository } from "../certificates/certificate.repository";
import { loadCertificateResourceRef } from "../certificates/certificate.resource-loaders";
import { structuredBodySchema } from "../community/community.dto";
import { loadPostResourceRef } from "../community/community.resource-loader";
import { communityRepository } from "../community/community.repository";
import { findCourseAuthProjection } from "../courses/courses.repository";
import { loadCourseResourceRef } from "../courses/load-course-resource-ref";

function extractStructuredBodyText(bodyJson: unknown): string {
  const parsed = structuredBodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return "";
  }

  return parsed.data.blocks
    .flatMap((block) =>
      block.children.filter((child) => child.type === "text").map((child) => child.text),
    )
    .join(" ")
    .trim();
}

const courseSearchAdapter: SearchSourceAdapter = {
  sourceContext: "learning",
  sourceType: "course",
  supportedEvents: ["course.published"],
  resolveSourceIdFromEvent(eventType, payload) {
    if (eventType !== "course.published") return null;
    const parsed = coursePublishedPayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data.courseId : null;
  },
  async buildIndexProjection(tx, _ctx, sourceId) {
    const course = await findCourseAuthProjection({ tx, courseId: sourceId });
    if (!course || course.status !== "PUBLISHED") {
      return null;
    }

    return {
      sourceContext: "learning",
      sourceType: "course",
      sourceId: course.id,
      title: course.title,
      body: course.description,
      visibility: "TENANT",
      accessJson: {
        courseId: course.id,
        status: course.status,
      },
    };
  },
  async resolveResultForActor({ tx, ctx, entry }) {
    const courseId = entry.source_id;
    const course = await findCourseAuthProjection({ tx, courseId });
    if (!course || course.status !== "PUBLISHED") {
      return null;
    }

    const resource = await loadCourseResourceRef({
      tx,
      ctx,
      courseId,
      requirePublished: true,
    });

    const decision = await can({
      tx,
      actor: { tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId },
      permission: "course.read",
      resource,
      ctx: { tenantId: ctx.tenantId, requestId: ctx.requestId },
    });

    if (!decision.allowed) {
      return null;
    }

    return {
      type: "course",
      title: course.title,
      snippet: "",
      actionPath: `/courses/${course.id}`,
    };
  },
  async iterateReindexBatch(tx, _ctx, cursor, batchSize) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; title: string; description: string | null }>
    >`
      select id::text, title, description
      from courses
      where tenant_id = current_setting('app.tenant_id')::uuid
        and deleted_at is null
        and status = 'PUBLISHED'
        and (
          ${cursor?.sourceId ?? null}::uuid is null
          or id > ${cursor?.sourceId ?? null}::uuid
        )
      order by id asc
      limit ${batchSize}
    `;

    const projections = rows.map((row) => ({
      sourceContext: "learning",
      sourceType: "course" as const,
      sourceId: row.id,
      title: row.title,
      body: row.description,
      visibility: "TENANT" as const,
      accessJson: { courseId: row.id, status: "PUBLISHED" },
    }));

    const last = rows[rows.length - 1];
    return {
      projections,
      nextCursor: last
        ? {
            sourceType: "course" as const,
            sourceId: last.id,
          }
        : null,
    };
  },
};

const postSearchAdapter: SearchSourceAdapter = {
  sourceContext: "community",
  sourceType: "post",
  supportedEvents: ["community.post.created"],
  resolveSourceIdFromEvent(eventType, payload) {
    if (eventType !== "community.post.created") return null;
    const parsed = communityPostCreatedPayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data.postId : null;
  },
  async buildIndexProjection(tx, _ctx, sourceId) {
    const post = await communityRepository.findPostById(tx, sourceId);
    if (!post || post.status !== "published") {
      return null;
    }

    const space = await communityRepository.findSpaceById(tx, post.space_id);
    if (!space) {
      return null;
    }

    const body = extractStructuredBodyText(post.body_json);
    const title = post.title?.trim() || body.slice(0, 120) || "Community post";

    return {
      sourceContext: "community",
      sourceType: "post",
      sourceId: post.id,
      title,
      body,
      visibility: space.visibility,
      accessJson: {
        spaceId: space.id,
        spaceVisibility: space.visibility,
        authorMembershipId: post.author_membership_id,
      },
    };
  },
  async resolveResultForActor({ tx, ctx, entry }) {
    const post = await communityRepository.findPostById(tx, entry.source_id);
    if (!post || post.status !== "published") {
      return null;
    }

    const resource = await loadPostResourceRef({
      tx,
      ctx,
      postId: post.id,
    });

    const decision = await can({
      tx,
      actor: { tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId },
      permission: "post.read",
      resource,
      ctx: { tenantId: ctx.tenantId, requestId: ctx.requestId },
    });

    if (!decision.allowed) {
      return null;
    }

    const title = post.title?.trim() || extractStructuredBodyText(post.body_json).slice(0, 120);

    return {
      type: "post",
      title,
      snippet: "",
      actionPath: `/community/posts/${post.id}`,
    };
  },
  async iterateReindexBatch(tx, _ctx, cursor, batchSize) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        title: string | null;
        body_json: unknown;
        space_visibility: string;
        space_id: string;
        author_membership_id: string;
      }>
    >`
      select
        p.id::text,
        p.title,
        p.body_json,
        s.visibility::text as space_visibility,
        s.id::text as space_id,
        p.author_membership_id::text
      from posts p
      inner join community_spaces s on s.id = p.space_id
      where p.tenant_id = current_setting('app.tenant_id')::uuid
        and p.deleted_at is null
        and p.status = 'published'
        and (
          ${cursor?.sourceId ?? null}::uuid is null
          or p.id > ${cursor?.sourceId ?? null}::uuid
        )
      order by p.id asc
      limit ${batchSize}
    `;

    const projections = rows.map((row) => {
      const body = extractStructuredBodyText(row.body_json);
      return {
        sourceContext: "community",
        sourceType: "post" as const,
        sourceId: row.id,
        title: row.title?.trim() || body.slice(0, 120) || "Community post",
        body,
        visibility: row.space_visibility as "TENANT" | "PRIVATE" | "UNLISTED",
        accessJson: {
          spaceId: row.space_id,
          spaceVisibility: row.space_visibility,
          authorMembershipId: row.author_membership_id,
        },
      };
    });

    const last = rows[rows.length - 1];
    return {
      projections,
      nextCursor: last
        ? {
            sourceType: "post" as const,
            sourceId: last.id,
          }
        : null,
    };
  },
};

const certificateSearchAdapter: SearchSourceAdapter = {
  sourceContext: "credentialing",
  sourceType: "certificate",
  supportedEvents: ["certificate.issued", "certificate.revoked"],
  resolveSourceIdFromEvent(eventType, payload) {
    if (eventType === "certificate.issued") {
      const parsed = certificateIssuedOutboxPayloadSchema.safeParse(payload);
      return parsed.success ? parsed.data.certificateId : null;
    }
    return null;
  },
  async buildIndexProjection(tx, ctx, sourceId) {
    const certificate = await certificateRepository.findCertificateById(tx, sourceId);
    if (!certificate || certificate.tenant_id !== ctx.tenantId || certificate.status !== "issued") {
      return null;
    }

    const template = await certificateRepository.findTemplateById(tx, certificate.template_id);
    const title = template?.name ?? "Certificate";

    return {
      sourceContext: "credentialing",
      sourceType: "certificate",
      sourceId: certificate.id,
      title,
      body: certificate.credential_id,
      visibility: "TENANT",
      accessJson: {
        membershipId: certificate.membership_id,
        credentialId: certificate.credential_id,
      },
    };
  },
  async resolveResultForActor({ tx, ctx, entry }) {
    const certificate = await certificateRepository.findCertificateById(tx, entry.source_id);
    if (!certificate || certificate.status !== "issued") {
      return null;
    }

    const resource = await loadCertificateResourceRef({
      tx,
      ctx,
      certificateId: certificate.id,
    });

    const decision = await can({
      tx,
      actor: { tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId },
      permission: "certificate.read",
      resource,
      ctx: { tenantId: ctx.tenantId, requestId: ctx.requestId },
    });

    if (!decision.allowed) {
      return null;
    }

    const template = await certificateRepository.findTemplateById(tx, certificate.template_id);

    return {
      type: "certificate",
      title: template?.name ?? "Certificate",
      snippet: "",
      actionPath: "/certificates",
    };
  },
  async iterateReindexBatch(tx, _ctx, cursor, batchSize) {
    const rows = await tx.$queryRaw<
      Array<{ id: string; template_name: string; credential_id: string; membership_id: string }>
    >`
      select
        c.id::text,
        ct.name as template_name,
        c.credential_id,
        c.membership_id::text
      from certificates c
      inner join certificate_templates ct on ct.id = c.template_id
      where c.tenant_id = current_setting('app.tenant_id')::uuid
        and c.status = 'issued'
        and (
          ${cursor?.sourceId ?? null}::uuid is null
          or c.id > ${cursor?.sourceId ?? null}::uuid
        )
      order by c.id asc
      limit ${batchSize}
    `;

    const projections = rows.map((row) => ({
      sourceContext: "credentialing",
      sourceType: "certificate" as const,
      sourceId: row.id,
      title: row.template_name,
      body: row.credential_id,
      visibility: "TENANT" as const,
      accessJson: {
        membershipId: row.membership_id,
        credentialId: row.credential_id,
      },
    }));

    const last = rows[rows.length - 1];
    return {
      projections,
      nextCursor: last
        ? {
            sourceType: "certificate" as const,
            sourceId: last.id,
          }
        : null,
    };
  },
};

export function registerSearchSourceAdapters(): void {
  registerSearchSourceAdapter(courseSearchAdapter);
  registerSearchSourceAdapter(postSearchAdapter);
  registerSearchSourceAdapter(certificateSearchAdapter);
}

registerSearchSourceAdapters();
