/**
 * Legal document shapes now live in the shared contract, because the documents
 * themselves are tenant configuration rather than app source. Re-exported here
 * so the existing imports in this folder keep working.
 */
export type {
  LegalContentBlock,
  LegalDocument,
  LegalDocumentSlug,
  LegalSection,
} from "@atlas/contracts/domain-branding/schemas/public-legal";
