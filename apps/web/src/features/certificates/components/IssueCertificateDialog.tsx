"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type IssueCertificateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  templates: Array<{ id: string; name: string }>;
  members: Array<{ id: string; label: string }>;
  defaultSource: { type: "course" | "learning_path" | "assessment"; id: string };
};

export function IssueCertificateDialog({
  open,
  onClose,
  onSuccess,
  templates,
  members,
  defaultSource,
}: IssueCertificateDialogProps) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [recipientMembershipId, setRecipientMembershipId] = useState(members[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.post(
        "/api/v1/certificates/issue",
        {
          templateId,
          recipientMembershipId,
          source: defaultSource,
        },
        "issue-certificate",
      );
      onSuccess();
      onClose();
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setMessage(caught.message);
        setRequestId(caught.requestId);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Issue certificate</h2>
        <label className="mt-4 block text-sm">
          Template
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={templateId}
            onChange={(event) => {
              setTemplateId(event.target.value);
            }}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          Recipient
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={recipientMembershipId}
            onChange={(event) => {
              setRecipientMembershipId(event.target.value);
            }}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </label>
        {message ? <p className="mt-4 text-sm text-red-700">{message}</p> : null}
        {requestId ? <p className="text-xs text-neutral-500">Request ID: {requestId}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-md px-3 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
            onClick={() => void submit()}
          >
            Issue
          </button>
        </div>
      </div>
    </div>
  );
}
