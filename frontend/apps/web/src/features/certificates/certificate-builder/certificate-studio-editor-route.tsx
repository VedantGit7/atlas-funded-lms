"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CertificateDesignDocument } from "@atlas/contracts/certificates/certificate-design-document";
import { CertificateStudioShell } from "./studio-shell";
import {
  fetchTemplate,
  isDesignDocument,
  publishTemplateDesign,
  saveTemplateDesign,
  slugifyTemplateKey,
} from "./studio-template-api";
import { findStarterById } from "./starter-templates";
import { CERTIFICATE_STUDIO_HOME, certificateStudioEditPath } from "./studio-routes";

type CertificateStudioEditorRouteProps = {
  publicName: string;
  /** Existing template id, or omit / use "new" for a blank/starter canvas. */
  templateId?: string;
  /** Starter preset id from `?starter=` on `/studio/new`. */
  starterId?: string | undefined;
};

type Session = {
  templateId?: string;
  name: string;
  document?: CertificateDesignDocument;
  updatedAt?: string;
};

/**
 * Canvas editor at `/admin/certificate-builder/studio/new` or `/studio/[templateId]`.
 * After the first save of a new design, the URL is replaced with `/studio/{id}`.
 */
export function CertificateStudioEditorRoute({
  publicName,
  templateId: templateIdProp,
  starterId,
}: CertificateStudioEditorRouteProps) {
  const router = useRouter();
  const isNew = !templateIdProp || templateIdProp === "new";

  // Stable, per-design autosave identity so drafts for different starters (or a
  // saved template) never collide on a shared "new" key.
  const autosaveId =
    !isNew && templateIdProp
      ? `template:${templateIdProp}`
      : starterId
        ? `starter:${starterId}`
        : "starter:blank-canvas";

  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"synced" | "unsaved" | "saving" | "error">("synced");
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session>({
    name: `${publicName} certificate`,
  });

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError(null);

    void (async () => {
      try {
        if (!isNew && templateIdProp) {
          const template = await fetchTemplate(templateIdProp);
          if (cancelled) return;
          const doc = isDesignDocument(template.templateJson)
            ? template.templateJson
            : undefined;
          setSession({
            templateId: template.id,
            name: template.name,
            updatedAt: template.updatedAt,
            ...(doc ? { document: doc } : {}),
          });
          if (!doc) {
            setStatusMessage(
              "This template uses the legacy text format. Start a new design in the studio, then Save.",
            );
          }
        } else {
          const starter = starterId ? findStarterById(starterId) : undefined;
          if (starter) {
            setSession({
              name: starter.id === "blank-canvas" ? `${publicName} certificate` : starter.name,
              document: starter.document,
            });
          } else {
            const blank = findStarterById("blank-canvas");
            setSession({
              name: `${publicName} certificate`,
              ...(blank?.document ? { document: blank.document } : {}),
            });
          }
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load template");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isNew, templateIdProp, starterId, publicName]);

  const backToHome = useCallback(() => {
    router.push(CERTIFICATE_STUDIO_HOME);
  }, [router]);

  const handleSave = useCallback(
    async (doc: CertificateDesignDocument, name: string) => {
      setStatusMessage("Saving…");
      setSaveStatus("saving");
      try {
        const result = await saveTemplateDesign({
          id: session.templateId,
          key: slugifyTemplateKey(name),
          name,
          templateJson: doc,
        });
        setSession({
          templateId: result.data.id,
          name: result.data.name,
          updatedAt: result.data.updatedAt,
          document: isDesignDocument(result.data.templateJson)
            ? result.data.templateJson
            : doc,
        });
        // Promote /studio/new → /studio/{id} after first save.
        if (isNew || session.templateId !== result.data.id) {
          router.replace(certificateStudioEditPath(result.data.id));
        }
        setStatusMessage("Saved");
        setSaveStatus("synced");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Save failed");
        setSaveStatus("error");
      }
    },
    [session.templateId, isNew, router],
  );

  const handlePublish = useCallback(
    async (doc: CertificateDesignDocument, name: string) => {
      setStatusMessage("Publishing…");
      setSaveStatus("saving");
      try {
        let id = session.templateId;
        if (!id) {
          const created = await saveTemplateDesign({
            key: slugifyTemplateKey(name),
            name,
            templateJson: doc,
          });
          id = created.data.id;
          setSession({
            templateId: id,
            name: created.data.name,
            updatedAt: created.data.updatedAt,
            document: isDesignDocument(created.data.templateJson)
              ? created.data.templateJson
              : doc,
          });
          router.replace(certificateStudioEditPath(id));
        } else {
          await saveTemplateDesign({
            id,
            key: slugifyTemplateKey(name),
            name,
            templateJson: doc,
          });
        }
        await publishTemplateDesign(id);
        setStatusMessage("Published");
        setSaveStatus("synced");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Publish failed");
        setSaveStatus("error");
      }
    },
    [session.templateId, router],
  );

  return (
    <div aria-label={`Certificate Studio editor for ${publicName}`}>
      <main style={{ minHeight: "100dvh", margin: 0 }}>
        {loadError ? (
          <div
            className="cert-studio"
            style={{
              padding: "2rem",
              color: "#f5f5f5",
              background: "#070b10",
            }}
          >
            <p role="alert">{loadError}</p>
            <button
              type="button"
              onClick={backToHome}
              style={{
                marginTop: "1rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 0.9rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(16, 217, 163, 0.45)",
                background: "rgba(16, 217, 163, 0.14)",
                color: "#10D9A3",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Go to Home screen
            </button>
          </div>
        ) : null}

        {!loadError && ready ? (
          <Suspense
            fallback={
              <div className="cert-studio__canvas-loading cert-studio__muted">
                Opening studio…
              </div>
            }
          >
            <CertificateStudioShell
              key={`studio-${session.templateId ?? starterId ?? "new"}`}
              brandName={publicName}
              initialTemplateName={session.name}
              autosaveId={autosaveId}
              saveStatus={saveStatus}
              {...(session.templateId ? { templateId: session.templateId } : {})}
              {...(session.document ? { initialDocument: session.document } : {})}
              {...(session.updatedAt ? { documentUpdatedAt: session.updatedAt } : {})}
              onBackHome={backToHome}
              onDirty={() => {
                setSaveStatus((current) => (current === "saving" ? current : "unsaved"));
              }}
              onSave={(doc, name) => {
                void handleSave(doc, name);
              }}
              onPublish={(doc, name) => {
                void handlePublish(doc, name);
              }}
            />
          </Suspense>
        ) : null}

        {statusMessage ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: "1rem",
              right: "1rem",
              zIndex: 200,
              padding: "0.6rem 1rem",
              borderRadius: "0.5rem",
              background: "#161c24",
              color: "#f5f5f5",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: "0.85rem",
            }}
          >
            {statusMessage}
          </div>
        ) : null}
      </main>
    </div>
  );
}
