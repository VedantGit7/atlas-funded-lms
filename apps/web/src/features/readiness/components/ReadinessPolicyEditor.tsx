"use client";

import { useMemo, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import { readinessApiClient } from "../../../modules/readiness/readiness.api-client";
import type { ReadinessPolicyDto } from "../../../server/readiness/readiness.types";
import type { ScoringProfileDto } from "../../../server/competency/competency-config.types";
import { CtaProminenceRulesEditor } from "./CtaProminenceRulesEditor";
import { LegalCopyEditor } from "./LegalCopyEditor";
import { OutboundRedirectEditor } from "./OutboundRedirectEditor";

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
    bandNotes: {},
    legalReviewChecklist: ["Copy reviewed for educational framing only."],
  },
};

export function ReadinessPolicyEditor({
  initialPolicy,
  scoringProfiles,
  canManage,
}: ReadinessPolicyEditorProps) {
  const initial = useMemo(
    () => ({
      scoringProfileId:
        initialPolicy?.scoringProfileId ?? scoringProfiles[0]?.id ?? defaultDraft.scoringProfileId,
      outboundTargetUrl:
        initialPolicy?.ctaPolicy.outboundTargetUrl ?? defaultDraft.outboundTargetUrl,
      tokenTtlSeconds: initialPolicy?.ctaPolicy.tokenTtlSeconds ?? defaultDraft.tokenTtlSeconds,
      bandProminenceRules:
        initialPolicy?.ctaPolicy.bandProminenceRules ?? defaultDraft.bandProminenceRules,
      ctaCopy: initialPolicy?.ctaPolicy.ctaCopy ?? defaultDraft.ctaCopy,
      legalCopy: initialPolicy?.legalCopy ?? defaultDraft.legalCopy,
    }),
    [initialPolicy, scoringProfiles],
  );

  const [draft, setDraft] = useState(initial);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [legalAcknowledged, setLegalAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setRequestId(null);
    setSavedMessage(null);

    try {
      await readinessApiClient.updateReadinessPolicy({
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
        legalCopy: draft.legalCopy,
        status: "ACTIVE",
      });
      setSavedMessage("Readiness policy saved.");
      setConfirmOpen(false);
      setLegalAcknowledged(false);
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
    <div className="space-y-6">
      <section className="rounded border p-4">
        <label className="block text-sm">
          Scoring profile
          <select
            className="mt-1 block w-full rounded border px-2 py-1"
            value={draft.scoringProfileId}
            disabled={!canManage}
            onChange={(event) => {
              setDraft({ ...draft, scoringProfileId: event.target.value });
            }}
          >
            {scoringProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.key})
              </option>
            ))}
          </select>
        </label>
      </section>

      <OutboundRedirectEditor
        outboundTargetUrl={draft.outboundTargetUrl}
        tokenTtlSeconds={draft.tokenTtlSeconds}
        disabled={!canManage}
        onTargetUrlChange={(value) => {
          setDraft({ ...draft, outboundTargetUrl: value });
        }}
        onTokenTtlChange={(value) => {
          setDraft({ ...draft, tokenTtlSeconds: value });
        }}
      />

      <section className="rounded border p-4 space-y-3">
        <h2 className="text-lg font-semibold">CTA copy</h2>
        <label className="block text-sm">
          Headline
          <input
            className="mt-1 block w-full rounded border px-2 py-1"
            value={draft.ctaCopy.headline}
            disabled={!canManage}
            onChange={(event) => {
              setDraft({
                ...draft,
                ctaCopy: { ...draft.ctaCopy, headline: event.target.value },
              });
            }}
          />
        </label>
        <label className="block text-sm">
          Body
          <textarea
            className="mt-1 block min-h-20 w-full rounded border px-2 py-1"
            value={draft.ctaCopy.body}
            disabled={!canManage}
            onChange={(event) => {
              setDraft({
                ...draft,
                ctaCopy: { ...draft.ctaCopy, body: event.target.value },
              });
            }}
          />
        </label>
        <label className="block text-sm">
          Button label
          <input
            className="mt-1 block w-full rounded border px-2 py-1"
            value={draft.ctaCopy.buttonLabel}
            disabled={!canManage}
            onChange={(event) => {
              setDraft({
                ...draft,
                ctaCopy: { ...draft.ctaCopy, buttonLabel: event.target.value },
              });
            }}
          />
        </label>
      </section>

      <CtaProminenceRulesEditor
        rules={draft.bandProminenceRules}
        disabled={!canManage}
        onChange={(rules) => {
          setDraft({ ...draft, bandProminenceRules: rules });
        }}
      />

      <LegalCopyEditor
        disclaimer={draft.legalCopy.disclaimer}
        bandNotes={draft.legalCopy.bandNotes}
        legalReviewChecklist={draft.legalCopy.legalReviewChecklist}
        disabled={!canManage}
        onDisclaimerChange={(value) => {
          setDraft({ ...draft, legalCopy: { ...draft.legalCopy, disclaimer: value } });
        }}
        onBandNotesChange={(value) => {
          setDraft({ ...draft, legalCopy: { ...draft.legalCopy, bandNotes: value } });
        }}
        onChecklistChange={(value) => {
          setDraft({ ...draft, legalCopy: { ...draft.legalCopy, legalReviewChecklist: value } });
        }}
      />

      {canManage ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded border px-4 py-2 text-sm font-medium"
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Save policy
          </button>
          {savedMessage ? <p className="text-sm text-green-700">{savedMessage}</p> : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-confirm-title"
        >
          <div className="max-w-md rounded border bg-white p-4 text-black shadow-lg">
            <h3 id="policy-confirm-title" className="text-lg font-semibold">
              Confirm readiness policy publish
            </h3>
            <p className="mt-2 text-sm">
              Confirm legal review is complete and copy remains educational without guaranteed
              outcomes.
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={legalAcknowledged}
                onChange={(event) => {
                  setLegalAcknowledged(event.target.checked);
                }}
              />
              <span>Legal review checklist completed outside the UI.</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setConfirmOpen(false);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm font-medium"
                onClick={() => void handleSave()}
                disabled={saving || !legalAcknowledged}
              >
                {saving ? "Saving…" : "Publish policy"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
