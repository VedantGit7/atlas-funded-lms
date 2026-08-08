"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { CertificateDesignDocument } from "@atlas/contracts/certificates/certificate-design-document";
import { CertificateBuilderSplash } from "./certificate-builder-splash";
import { CertificateStudioHome } from "./studio-home";
import { CertificateStudioShell } from "./studio-shell";
import {
  fetchTemplate,
  isDesignDocument,
  publishTemplateDesign,
  saveTemplateDesign,
  slugifyTemplateKey,
} from "./studio-template-api";

type CertificateBuilderPageProps = {
  publicName: string;
};

type StudioSession = {
  templateId?: string;
  name: string;
  document?: CertificateDesignDocument;
  updatedAt?: string;
};

type View = "home" | "studio";

/**
 * Boot splash → Studio Home → canvas.
 * Deep-link `?templateId=` skips Home and opens the canvas directly.
 */
export function CertificateBuilderPage({ publicName }: CertificateBuilderPageProps) {
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get("templateId");

  const [bootDone, setBootDone] = useState(false);
  const [view, setView] = useState<View>(templateIdParam ? "studio" : "home");
  const [sessionKey, setSessionKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [session, setSession] = useState<StudioSession>({
    name: `${publicName} certificate`,
    ...(templateIdParam ? { templateId: templateIdParam } : {}),
  });
  const [ready, setReady] = useState(!templateIdParam);

  const handleSplashFinished = useCallback(() => {
    setBootDone(true);
  }, []);

  useEffect(() => {
    if (!templateIdParam) {
      setReady(true);
      setView("home");
      return;
    }

    let cancelled = false;
    setReady(false);
    setLoadError(null);
    setView("studio");

    void (async () => {
      try {
        const template = await fetchTemplate(templateIdParam);
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
  }, [templateIdParam]);

  const syncUrl = useCallback((templateId: string | undefined) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (templateId) url.searchParams.set("templateId", templateId);
    else url.searchParams.delete("templateId");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const openStudio = useCallback(
    (args: StudioSession) => {
      setSession({
        name: args.name,
        ...(args.templateId ? { templateId: args.templateId } : {}),
        ...(args.document ? { document: args.document } : {}),
        ...(args.updatedAt ? { updatedAt: args.updatedAt } : {}),
      });
      setSessionKey((k) => k + 1);
      setView("studio");
      setLoadError(null);
      setReady(true);
      syncUrl(args.templateId);
    },
    [syncUrl],
  );

  const backToHome = useCallback(() => {
    setView("home");
    setSession({ name: `${publicName} certificate` });
    setStatusMessage(null);
    setLoadError(null);
    syncUrl(undefined);
  }, [publicName, syncUrl]);

  const handleSave = useCallback(
    async (doc: CertificateDesignDocument, name: string) => {
      setStatusMessage("Saving…");
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
        syncUrl(result.data.id);
        setStatusMessage("Saved");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Save failed");
      }
    },
    [session.templateId, syncUrl],
  );

  const handlePublish = useCallback(
    async (doc: CertificateDesignDocument, name: string) => {
      setStatusMessage("Publishing…");
      try {
        let id = session.templateId;
        if (!id) {
          const created = await saveTemplateDesign({
            key: slugifyTemplateKey(name),
            name,
            templateJson: doc,
          });
          id = created.data.id;
          setSession((prev) => ({
            ...prev,
            templateId: id,
            name: created.data.name,
            updatedAt: created.data.updatedAt,
            document: isDesignDocument(created.data.templateJson)
              ? created.data.templateJson
              : doc,
          }));
          syncUrl(id);
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
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Publish failed");
      }
    },
    [session.templateId, syncUrl],
  );

  return (
    <>
      {!bootDone ? (
        <CertificateBuilderSplash publicName={publicName} onFinished={handleSplashFinished} />
      ) : null}

      {bootDone ? (
        <div aria-label={`Certificate Studio for ${publicName}`}>
          {view === "home" ? (
            <CertificateStudioHome publicName={publicName} onOpenStudio={openStudio} />
          ) : null}

          {view === "studio" ? (
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
                    key={`studio-${sessionKey}-${session.templateId ?? "new"}`}
                    brandName={publicName}
                    initialTemplateName={session.name}
                    {...(session.templateId ? { templateId: session.templateId } : {})}
                    {...(session.document ? { initialDocument: session.document } : {})}
                    {...(session.updatedAt ? { documentUpdatedAt: session.updatedAt } : {})}
                    onBackHome={backToHome}
                    onSave={(doc, name) => {
                      void handleSave(doc, name);
                    }}
                    onPublish={(doc, name) => {
                      void handlePublish(doc, name);
                    }}
                  />
                </Suspense>
              ) : null}
            </main>
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
        </div>
      ) : null}
    </>
  );
}
