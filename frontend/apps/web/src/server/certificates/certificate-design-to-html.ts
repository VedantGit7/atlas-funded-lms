/**
 * Server-side re-export of the shared certificate HTML renderer.
 * Keeps server imports stable while the implementation lives with the studio.
 */
export {
  designDocumentToHtmlAsync,
  sampleDataFromVariables,
  type DesignToHtmlOptions,
} from "../../features/certificates/certificate-builder/render/design-to-html";
