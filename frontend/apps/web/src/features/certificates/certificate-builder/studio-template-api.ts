/**
 * Client helpers for loading/saving Certificate Studio designs
 * against `/api/v1/certificate-templates`.
 */

import type { CertificateDesignDocument } from "@atlas/contracts/certificates/certificate-design-document";
import type {
  certificateTemplateDetailResponseSchema,
  certificateTemplateDtoSchema,
  certificateTemplateListResponseSchema,
} from "@atlas/contracts/certificates/certificate.dto";
import type { z } from "zod";
import { clientApi } from "../../../lib/client-api";

type TemplateDto = z.infer<typeof certificateTemplateDtoSchema>;
type TemplateListResponse = z.infer<typeof certificateTemplateListResponseSchema>;
type TemplateDetailResponse = z.infer<typeof certificateTemplateDetailResponseSchema>;

export function isDesignDocument(json: unknown): json is CertificateDesignDocument {
  return (
    typeof json === "object" &&
    json !== null &&
    "schemaVersion" in json &&
    (json as { schemaVersion?: number }).schemaVersion === 1
  );
}

export async function listTemplates(): Promise<TemplateDto[]> {
  const list = await clientApi.get<TemplateListResponse>("/api/v1/certificate-templates");
  return list.data;
}

export async function fetchTemplate(id: string): Promise<TemplateDto> {
  const list = await listTemplates();
  const found = list.find((template) => template.id === id);
  if (!found) {
    throw new Error(`Certificate template not found: ${id}`);
  }
  return found;
}

export async function deleteTemplateDesign(id: string): Promise<void> {
  await clientApi.delete(
    "/api/v1/certificate-templates",
    "studio-template-delete",
    { id },
    { successMessage: "Template deleted" },
  );
}

export async function duplicateTemplateDesign(template: TemplateDto): Promise<TemplateDetailResponse> {
  const baseName = template.name.replace(/\s*\(copy\)\s*$/i, "").trim();
  const name = `${baseName} (copy)`;
  const templateJson = isDesignDocument(template.templateJson)
    ? template.templateJson
    : {
        schemaVersion: 1 as const,
        page: { width: 297, height: 210, unit: "mm" as const, orientation: "landscape" as const },
        background: { type: "color" as const, value: "#FFFDF8" },
        brandKitRef: null,
        variables: [],
        rules: [],
        elements: [],
      };

  return clientApi.post<TemplateDetailResponse>(
    "/api/v1/certificate-templates",
    {
      key: slugifyTemplateKey(`${name}-${Date.now().toString(36)}`),
      name,
      templateJson,
    },
    "studio-template-duplicate",
    { successMessage: "Template duplicated" },
  );
}

export type SaveTemplateDesignInput = {
  id?: string | undefined;
  key: string;
  name: string;
  templateJson: CertificateDesignDocument;
};

export async function saveTemplateDesign(
  input: SaveTemplateDesignInput,
): Promise<TemplateDetailResponse> {
  if (input.id) {
    return clientApi.put<TemplateDetailResponse>(
      "/api/v1/certificate-templates",
      {
        id: input.id,
        name: input.name,
        templateJson: input.templateJson,
      },
      "studio-template-update",
    );
  }

  return clientApi.post<TemplateDetailResponse>(
    "/api/v1/certificate-templates",
    {
      key: input.key,
      name: input.name,
      templateJson: input.templateJson,
    },
    "studio-template-create",
  );
}

export async function publishTemplateDesign(
  id: string,
  body: object = {},
): Promise<TemplateDetailResponse> {
  return clientApi.post<TemplateDetailResponse>(
    `/api/v1/certificate-templates/${id}/publish`,
    body,
    "studio-template-publish",
  );
}

export function slugifyTemplateKey(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug.length >= 2 ? slug : `design-${Date.now().toString(36)}`;
}
