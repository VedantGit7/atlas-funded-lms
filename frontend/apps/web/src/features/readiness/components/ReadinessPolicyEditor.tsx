"use client";

import { useMemo, useState } from "react";
import { Rocket } from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError } from "../../../lib/client-api";
import { readinessApiClient } from "@/modules/readiness/readiness.api-client";
import type { ReadinessPolicyDto } from "@atlas/contracts/readiness/readiness.types";
import type { ScoringProfileDto } from "@atlas/contracts/competency/competency-config.types";
import { alertErrorClassName, defaultLegalChecklist } from "../readiness-admin-shared";
import { BandProminenceRulesPanel } from "./BandProminenceRulesPanel";
import { CtaContentPanel } from "./CtaContentPanel";
import { LegalDisclaimersPanel } from "./LegalDisclaimersPanel";
import { LegalReviewChecklistPanel } from "./LegalReviewChecklistPanel";
import { ReadinessPolicyFooter } from "./ReadinessPolicyFooter";
import { ReadinessPolicyPageHeader } from "./ReadinessPolicyPageHeader";
import { TechnicalRoutingPanel } from "./TechnicalRoutingPanel";

type ReadinessPolicyEditorProps = {
  initialPolicy: ReadinessPolicyDto | null;
  scoringProfiles: ScoringProfileDto[];
  canManage: boolean;
};

const defaultDraft = {
  scoringProfileId: "",
  outboundTargetUrl: "https://example.com/education-handoff",
  tokenTtlSeconds: 3600,
  bandProminenceRules: [{ bandKey: "developing", prominence: "hidden" }],
  ctaCopy: {
    headline: "Continue your learning journey",
    body: "Explore the next educational step when you feel ready.",
    buttonLabel: "Continue externally",
  },
  legalCopy: {
    disclaimer:
      "This readiness view is educational only and does not constitute investment advice or a guarantee of outcomes.",
    bandNotes: {} as Record<string, string>,
    legalReviewChecklist: [...defaultLegalChecklist],
  },
};

function buildDraft(
  initialPolicy: ReadinessPolicyDto | null,
  scoringProfiles: ScoringProfileDto[],
) {
  const checklist =
    initialPolicy?.legalCopy?.legalReviewChecklist.filter((item) => item.trim().length > 0) ?? [];

  return {
    scoringProfileId:
      initialPolicy?.scoringProfileId ?? scoringProfiles[0]?.id ?? defaultDraft.scoringProfileId,
    outboundTargetUrl: initialPolicy?.ctaPolicy.outboundTargetUrl ?? defaultDraft.outboundTargetUrl,
    tokenTtlSeconds: initialPolicy?.ctaPolicy.tokenTtlSeconds ?? defaultDraft.tokenTtlSeconds,
    bandProminenceRules:
      initialPolicy?.ctaPolicy.bandProminenceRules ?? defaultDraft.bandProminenceRules,
    ctaCopy: initialPolicy?.ctaPolicy.ctaCopy ?? defaultDraft.ctaCopy,
    legalCopy: {
      disclaimer: initialPolicy?.legalCopy?.disclaimer ?? defaultDraft.legalCopy.disclaimer,
      bandNotes: initialPolicy?.legalCopy?.bandNotes ?? defaultDraft.legalCopy.bandNotes,
      legalReviewChecklist:
        checklist.length > 0 ? checklist : [...defaultDraft.legalCopy.legalReviewChecklist],
    },
  };
}

function draftsEqual(a: ReturnType<typeof buildDraft>, b: ReturnType<typeof buildDraft>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ReadinessPolicyEditor({
  initialPolicy,
  scoringProfiles,
  canManage,
}: ReadinessPolicyEditorProps) {
  const initial = useMemo(
    () => buildDraft(initialPolicy, scoringProfiles),
    [initialPolicy, scoringProfiles],
  );

  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [policyMeta, setPolicyMeta] = useState(initialPolicy);
  const [checklistChecked, setChecklistChecked] = useState<Record<number, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const selectedProfile =
    scoringProfiles.find((profile) => profile.id === draft.scoringProfileId) ?? null;

  const isDirty = !draftsEqual(draft, baseline);
  const checklistItems = draft.legalCopy.legalReviewChecklist;
  const resolvedCount = checklistItems.filter((_, index) => checklistChecked[index]).length;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setRequestId(null);

    try {
      const response = await readinessApiClient.updateReadinessPolicy({
        scoringProfileId: draft.scoringProfileId,
        ctaPolicy: {
          outboundTargetUrl: draft.outboundTargetUrl,
          tokenTtlSeconds: draft.tokenTtlSeconds,
          bandProminenceRules: draft.bandProminenceRules.map((rule) => ({
            bandKey: rule.bandKey,
            prominence: rule.prominence as "hidden" | "subtle" | "standard" | "prominent",
          })),
          ctaCopy: draft.ctaCopy,
        },
        legalCopy: {
          ...draft.legalCopy,
          legalReviewChecklist: draft.legalCopy.legalReviewChecklist.filter(
            (item) => item.trim().length > 0,
          ),
        },
        status: "ACTIVE",
      });
      const saved = buildDraft(response.data, scoringProfiles);
      setDraft(saved);
      setBaseline(saved);
      setPolicyMeta(response.data);
      setConfirmOpen(false);
      setChecklistChecked({});
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(err.message);
        setRequestId(err.requestId);
      } else {
        setError("Failed to save readiness policy.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-theme mx-auto max-w-5xl space-y-6 pb-8 text-[var(--admin-on-surface)]">
      <ReadinessPolicyPageHeader policy={policyMeta} scoringProfile={selectedProfile} />

      <BandProminenceRulesPanel
        rules={draft.bandProminenceRules}
        disabled={!canManage}
        onChange={(rules) => {
          setDraft({ ...draft, bandProminenceRules: rules });
        }}
      />

      <CtaContentPanel
        ctaCopy={draft.ctaCopy}
        disabled={!canManage}
        onChange={(ctaCopy) => {
          setDraft({ ...draft, ctaCopy });
        }}
      />

      <TechnicalRoutingPanel
        scoringProfileId={draft.scoringProfileId}
        scoringProfiles={scoringProfiles}
        outboundTargetUrl={draft.outboundTargetUrl}
        tokenTtlSeconds={draft.tokenTtlSeconds}
        disabled={!canManage}
        onScoringProfileChange={(value) => {
          setDraft({ ...draft, scoringProfileId: value });
        }}
        onTargetUrlChange={(value) => {
          setDraft({ ...draft, outboundTargetUrl: value });
        }}
        onTokenTtlChange={(value) => {
          setDraft({ ...draft, tokenTtlSeconds: value });
        }}
      />

      <LegalDisclaimersPanel
        disclaimer={draft.legalCopy.disclaimer}
        bandNotes={draft.legalCopy.bandNotes}
        disabled={!canManage}
        onDisclaimerChange={(value) => {
          setDraft({ ...draft, legalCopy: { ...draft.legalCopy, disclaimer: value } });
        }}
        onBandNotesChange={(value) => {
          setDraft({ ...draft, legalCopy: { ...draft.legalCopy, bandNotes: value } });
        }}
      />

      <LegalReviewChecklistPanel
        items={checklistItems}
        checked={checklistChecked}
        disabled={!canManage}
        onItemsChange={(items) => {
          setDraft({
            ...draft,
            legalCopy: { ...draft.legalCopy, legalReviewChecklist: items },
          });
        }}
        onCheckedChange={setChecklistChecked}
      />

      {error ? (
        <div className={alertErrorClassName} role="alert">
          {error}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </div>
      ) : null}

      {canManage ? (
        <ReadinessPolicyFooter
          resolvedCount={resolvedCount}
          totalCount={checklistItems.length}
          canPublish={canManage}
          isDirty={isDirty}
          saving={saving}
          onDiscard={() => {
            setDraft(baseline);
            setChecklistChecked({});
            setError(null);
            setRequestId(null);
          }}
          onPublish={() => {
            setConfirmOpen(true);
          }}
        />
      ) : null}

      <AdminConfirmDialog
        open={confirmOpen}
        title="Publish readiness policy"
        description={
          <div className="space-y-2 text-sm text-[var(--admin-on-surface-variant)]">
            <p>
              This will activate the configured CTA prominence, legal copy, and outbound routing for
              all learners on the linked scoring profile.
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>Profile: {selectedProfile?.name ?? "Not selected"}</li>
              <li>{draft.bandProminenceRules.length} band prominence rules</li>
              <li>{checklistItems.length} legal checklist items acknowledged</li>
            </ul>
          </div>
        }
        confirmLabel="Publish policy"
        busyLabel="Publishing…"
        icon={Rocket}
        busy={saving}
        error={confirmOpen ? error : null}
        onConfirm={() => {
          void handleSave();
        }}
        onCancel={() => {
          if (!saving) {
            setConfirmOpen(false);
            setError(null);
            setRequestId(null);
          }
        }}
      />
    </div>
  );
}
