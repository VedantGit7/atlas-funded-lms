// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

/**
 * Server-side re-export of the shared certificate HTML renderer.
 * Keeps server imports stable while the implementation lives with the studio.
 */
export {
  designDocumentToHtmlAsync,
  sampleDataFromVariables,
  type DesignToHtmlOptions,
} from "../../features/certificates/certificate-builder/render/design-to-html";
