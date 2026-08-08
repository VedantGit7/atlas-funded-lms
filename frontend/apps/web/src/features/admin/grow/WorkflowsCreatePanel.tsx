"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  WORKFLOWS_LIST_HREF,
  workflowHref,
  type WorkflowDto,
} from "./workflows-shared";

const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--admin-on-surface)]";

type WorkflowResponse = { data: WorkflowDto };

export function WorkflowsCreatePanel() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allowResubscribe, setAllowResubscribe] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<WorkflowResponse>(
        "/api/v1/marketing/workflows",
        {
          title: title.trim(),
          description: description.trim() || null,
          allowResubscribe,
        },
        "workflow-create",
        { successMessage: "Workflow created." },
      );
      router.push(`${workflowHref(response.data.id)}?pickUseCase=1`);
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not create workflow.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={WORKFLOWS_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Link>

      <header className="space-y-2">
        <h1 className={managePageTitleClassName}>Create workflow</h1>
        <p className={managePageDescClassName}>
          Name the workflow, then choose a use case and configure the flow.
        </p>
      </header>

      <div className="space-y-4 border border-[var(--admin-outline)] p-5">
        <div>
          <label htmlFor="wf-title" className={LABEL_CLASS}>
            Title
          </label>
          <input
            id="wf-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={FIELD_CLASS}
            maxLength={200}
            placeholder="Welcome nurture sequence"
          />
        </div>
        <div>
          <label htmlFor="wf-description" className={LABEL_CLASS}>
            Description
          </label>
          <textarea
            id="wf-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`${FIELD_CLASS} min-h-28`}
            maxLength={2000}
            placeholder="Optional notes for your team"
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-[var(--admin-on-surface)]">
          <input
            type="checkbox"
            checked={allowResubscribe}
            onChange={(event) => setAllowResubscribe(event.target.checked)}
            className="mt-1"
          />
          <span>
            Allow re-entry
            <span className="mt-1 block text-[var(--admin-on-surface-variant)]">
              Learners can enter this workflow again after completing it.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={managePrimaryButtonClassName}
          disabled={busy}
          onClick={() => void onCreate()}
        >
          {busy ? "Creating…" : "Continue"}
        </button>
        <Link href={WORKFLOWS_LIST_HREF} prefetch={false} className={manageSecondaryButtonClassName}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
